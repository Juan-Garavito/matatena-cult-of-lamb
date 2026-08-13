import {
  END,
  START,
  StateGraph,
  Annotation,
  MessagesAnnotation,
} from "@langchain/langgraph";
// import { ChatOllama } from "@langchain/ollama";
import { z } from "zod";
import { BotsSchema, GameSchema } from "../types/game.schema.js";
import {
  createPlayerAgent,
  playGameAgent,
  readRulesGameAgent,
  sendMessageAgent,
  JoinToGameAgent,
} from "./tools.js";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { ChatGoogle } from "@langchain/google";
import { AgentUnavailableError, classifyAgentError } from "./errors.js";

// const model = new ChatOllama({
//   model: "hf.co/TheBloke/phi-2-GGUF:Q8_0",
//   baseUrl: "http://localhost:11434",
//   keepAlive: "5m",
//   numCtx: 4650,
//   think: false,
// });

/**
 * A stuck turn is worse than a fast failure: cap how long the human waits for
 * the bot before falling back to a local move.
 */
const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS ?? 20_000);

const model = new ChatGoogle({
  model: process.env.GOOGLE_MODEL!,
  apiKey: process.env.GOOGLE_API_KEY!,
  // Default is 6 retries, which turns an exhausted quota into a very long
  // wait. Two attempts absorb a transient blip and give up quickly otherwise.
  maxRetries: 2,
});

const toolsNewPlayer = [createPlayerAgent, JoinToGameAgent];
const toolsPlayGame = [playGameAgent, readRulesGameAgent];
const toolsSendMessage = [sendMessageAgent];
const tools = [...toolsNewPlayer, ...toolsPlayGame, ...toolsSendMessage];

const AgentNewPlayer = model.bindTools(toolsNewPlayer);
const PlayGameAgent = model.bindTools(toolsPlayGame);
const SendMessageAgent = model.bindTools(toolsSendMessage);

type BoundAgent = typeof AgentNewPlayer;

/**
 * Single entry point for every LLM call: bounds the wait with an abort signal
 * and normalizes whatever fails into an `AgentUnavailableError`, so no node
 * leaks a raw SDK error into the graph.
 */
const invokeModel = async (
  agent: BoundAgent,
  messages: BaseMessage[],
  context: string,
) => {
  try {
    return await agent.invoke(messages, {
      signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
    });
  } catch (cause) {
    throw classifyAgentError(cause, context);
  }
};

const RequestType = z.enum(["create_player", "play_game", "send_message"]);
const StateAgent = Annotation.Root({
  request: Annotation<z.infer<typeof RequestType>>(),
  player: Annotation<z.infer<typeof BotsSchema> | undefined>(),
  message: Annotation<string>(),
  gameState: Annotation<z.infer<typeof GameSchema> | undefined>(),
  ...MessagesAnnotation.spec,
});

type AgentState = typeof StateAgent.State;

const toolNode = new ToolNode(tools);

const routeRequest = (state: AgentState): string | string[] => {
  if (state.request === "create_player") return "create_player";
  if (state.request === "play_game") return "play_game";
  if (state.request === "send_message") return "send_message";
  return "unknown_request";
};

const createPlayerNode = async (state: AgentState) => {
  console.log("CREANDO EL BOT");
  const response = await invokeModel(
    AgentNewPlayer,
    [
      new SystemMessage(
        "You are a creator the new players or boots. You should invent a name, unique personality and a smart level between 1 and 10. And after IT IS MOST IMPORTANT  this new player join a game with the id_game that the user send you.",
      ),

      new HumanMessage(
        `Request: "${state.request}" and id_game is "${state.gameState?.id_game}. You have to create the name, personality any the smart for the new player" `,
      ),
      ...state.messages,
    ],
    "create_player",
  );
  console.log("Response create player:", response);
  return { messages: [response] };
};

const playGameNode = async (state: AgentState) => {
  console.log("REALIZANDO JUGADA");
  console.log(state);
  const response = await invokeModel(
    PlayGameAgent,
    [
      new SystemMessage(
        "You are a player of matatena, you task is made a play in the game. You will get the dice value,  and the id_game.  You have read the rules to understand the game bette. Depends,  you level in the game You have adopt a position more competitive or less competitive. You always have to decide some column between 0 and 2",
      ),
      new HumanMessage(
        `Your dice value is  ${state.gameState?.game.dice}. Your level the game is ${state.player?.smart}. The actual state for game is the next ${JSON.stringify(state.gameState)} and the These is your data: ${JSON.stringify(state.player)}. If you dont know the rules for this game then You have to read rules`,
      ),
      ...state.messages,
    ],
    "play_game",
  );

  console.log("Response play game:", response);
  return { messages: [response] };
};

const sendMessageNode = async (state: AgentState) => {
  console.log("ENVIANDO MENSAJE");
  const response = await invokeModel(
    SendMessageAgent,
    [
      new SystemMessage(
        "Yoa are a player of matatena, you task is send a message to another player. The answer has match with your personality",
      ),
      new HumanMessage(
        `The message of player is "${state.message}". You are ${JSON.stringify(state.player)} and your id player ${state.player?.id} and the id de game "${state.gameState?.id_game}" `,
      ),
      ...state.messages,
    ],
    "send_message",
  );

  console.log("Response send message:", response);
  return { messages: [response] };
};

const routeTools = (state: AgentState): string => {
  const aiMessages = state.messages
    .filter((m): m is AIMessage => m instanceof AIMessage)
    .reverse();

  const lastAIMessage = aiMessages[0];
  const toolCalled = lastAIMessage?.tool_calls?.[0]?.name;

  if (!toolCalled) return "unknown_request";

  console.log("ROUTE TOOLS", toolCalled);

  if (toolCalled === JoinToGameAgent.name) {
    const isMyTurn =
      state.gameState?.game.players[state.gameState.game.turn]?.type === "bot";
    return isMyTurn ? "play_game" : "unknown_request";
  }

  if (toolsNewPlayer.some((t) => t.name === toolCalled)) return "create_player";
  if (toolsPlayGame.some((t) => t.name === toolCalled)) return "play_game";
  if (toolsSendMessage.some((t) => t.name === toolCalled))
    return "send_message";
  return "unknown_request";
};

const workflow = new StateGraph(StateAgent)
  .addNode("create", createPlayerNode)
  .addNode("play", playGameNode)
  .addNode("send", sendMessageNode)
  .addNode("tools", toolNode)
  .addConditionalEdges(START, routeRequest, {
    create_player: "create",
    play_game: "play",
    send_message: "send",
    unknown_request: END,
  })
  .addConditionalEdges("create", toolsCondition, {
    tools: "tools",
    __end__: END,
  })
  .addConditionalEdges("play", toolsCondition, {
    tools: "tools",
    __end__: END,
  })

  .addConditionalEdges("send", toolsCondition, {
    tools: "tools",
    __end__: END,
  })
  .addConditionalEdges("tools", routeTools, {
    create_player: "create",
    play_game: "play",
    send_message: "send",
    unknown_request: END,
  })
  .compile();

export type AgentRunInput = Omit<AgentState, "messages">;

export type AgentRunResult =
  | { ok: true }
  | { ok: false; error: AgentUnavailableError };

/**
 * Runs the graph and never throws: the agent is an optional luxury, so every
 * failure comes back as `{ ok: false }` for `agent/recovery.ts` to handle.
 */
export const runAgent = async ({
  request,
  gameState,
  player,
  message,
}: AgentRunInput): Promise<AgentRunResult> => {
  try {
    await workflow.invoke({
      request,
      gameState,
      player,
      message: message || "",
    });
    return { ok: true };
  } catch (cause) {
    return { ok: false, error: classifyAgentError(cause, request) };
  }
};
