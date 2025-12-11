import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from "zod";
import { tasksService } from "./services/task.service.js";


const server = new McpServer({
    name: "NotiFly MCP Server",
    version: "1.0.0",
});

server.registerTool(
    "add",
    {
        title: "Add/Schedule a new task",
        description: "Create a new task in the NotiFly system",
        inputSchema: {
            owner_id: z.string().describe("The ID of the task owner"),
            title: z.string().describe("The title of the task"),
            description: z.string().optional().describe("The description of the task"),
            due_date: z.string().optional().describe("The due date of the task in YYYY-MM-DD format"),
            due_time: z.string().optional().describe("The due time of the task in HH:MM format"),
            status: z.string().optional().describe("The status of the task (default is 'pending')"),
        },
    },
    async (args) => {
        try {
            const task = await tasksService.createTask(args);
            return {
                content: [
                    {
                        type: "text",
                        text: `Task "${task.title}" added successfully with ID: ${task.task_id}`,
                    },
                ],
            };
        }
        catch (err) {
            console.error("Error creating task via MCP tool 'add':", err);
            return {
                content: [
                    {
                        type: "text",
                        text: `Error creating task: ${err.message}`,
                    },
                ],
            };
        }
    }
);

server.registerTool(
    "listDay",
    {
        title: "List tasks for a specific day",
        description: "Retrieve all tasks for a given day",
        inputSchema: {
            owner_id: z.string().describe("The ID of the task owner"),
            date: z.string().describe("The date to list tasks for in YYYY-MM-DD format"),
        },
    },
    async (args) => {
        const tasks = await tasksService.listTasksForDay(args.owner_id, args.date);
        return {
            content: tasks.length
                ? tasks.map((task) => ({
                    type: "text",
                    text: `- [${task.status}] ${task.title} (Due: ${task.due_date || "N/A"} ${task.due_time || ""})`,
                }))
                : [
                    {
                        type: "text",
                        text: `No tasks found for ${args.date}.`,
                    },
                ],
        };
    }
);

server.registerTool(
    "listRange",
    {
        title: "List tasks for a date range",
        description: "Retrieve all tasks within a specified date range",
        inputSchema: {
            owner_id: z.string().describe("The ID of the task owner"),
            start: z.string().describe("The start date in YYYY-MM-DD format"),
            end: z.string().describe("The end date in YYYY-MM-DD format"),
        },
    },
    async (args) => {
        const tasks = await tasksService.listTasksForRange(args.owner_id, args.start, args.end);
        return {
            content: tasks.length
                ? tasks.map((task) => ({
                    type: "text",
                    text: `- [${task.status}] ${task.title} (Due: ${task.due_date || "N/A"} ${task.due_time || ""})`,
                }))
                : [
                    {
                        type: "text",
                        text: `No tasks found from ${args.start} to ${args.end}.`,
                    },
                ],
        };
    }
);

server.registerTool(
    "markDone",
    {
        title: "Mark a task as done",
        description: "Mark an existing task as completed",
        inputSchema: {
            owner_id: z.string().describe("The ID of the task owner"),
            task_id: z.string().describe("The ID of the task to mark as done"),
        },
    },
    async (args) => {
        const task = await tasksService.markTaskDone(args.owner_id, args.task_id);
        if (!task) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Task with ID ${args.task_id} not found.`,
                    },
                ],
            };
        }
        return {
            content: [
                {
                    type: "text",
                    text: `Task "${task.title}" marked as done.`,
                },
            ],
        };
    }
);

server.registerPrompt(
    "smart_task_planner",
    {
        title: "Smart task planner",
        description: "Plan the user's tasks intelligently even from a vague request",
        argsSchema: {
            owner_id: z.string().describe("The ID of the task owner"),
            raw_input: z.string().describe("The original, possibly vague, user request about their tasks"),
            today: z.string().optional().describe("Today's date in YYYY-MM-DD format"),
        },
    },
    async ({ owner_id, raw_input, today }) => ({
        messages: [
            {
                role: "assistant",
                content: {
                    type: "text",
                    text: `
You are NotiFly, an intelligent task planning assistant.

Your goals:
- Interpret vague, messy user requests about tasks and schedules.
- When needed, ask short, objective clarification questions.
- Use the available tools to read and modify the user's tasks.
- Return a clear, structured plan for the user.

Available tools (MCP):
- "add": create a new task for the user.
- "listDay": list all tasks for a given day.
- "listRange": inspect tasks across a date range.
- "markDone": mark an existing task as done.

Behavior guidelines:
- If the user says things like "joga isso pra amanhã", interpret dates relative to "today" if provided.
- Prefer to look at the user's tasks (via listDay or listRange) before making big changes.
- If the request is too ambiguous (for example, you don't know which task they mean), ask 1–2 clarification questions instead of guessing wildly.
- Always explain briefly what you did (e.g. which tasks were moved or completed).

Context:
- owner_id: ${owner_id}
- today (if provided): ${today || "not provided"}

Now the user sent this request (possibly vague), and you must understand what they want and decide how to use the tools above:

"${raw_input}"
        `.trim(),
                },
            },
            {
                role: "user",
                content: {
                    type: "text",
                    text: raw_input,
                },
            },
        ],
    })
);


const transport = new StdioServerTransport();

await server.connect(transport);