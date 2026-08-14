export const discordCommands = [
  {
    name: "my-list",
    description: "See the cards that involve you",
    type: 1,
  },
  {
    name: "card",
    description: "Add or update a card on The Board",
    type: 1,
    options: [
      {
        type: 1,
        name: "add",
        description: "Add a card",
        options: [
          {
            type: 3,
            name: "board",
            description: "Board name or ID",
            required: false,
          },
        ],
      },
      {
        type: 1,
        name: "open",
        description: "Open a card",
        options: [
          {
            type: 3,
            name: "key",
            description: "Card ID, such as WEB-21",
            required: true,
          },
        ],
      },
      {
        type: 1,
        name: "update",
        description: "Update a card",
        options: [
          { type: 3, name: "key", description: "Card ID", required: true },
          { type: 3, name: "title", description: "New title", required: false },
          { type: 3, name: "notes", description: "New notes", required: false },
          {
            type: 3,
            name: "tags",
            description: "Comma-separated tag names",
            required: false,
          },
          {
            type: 3,
            name: "importance",
            description: "How important is it?",
            required: false,
            choices: ["none", "low", "medium", "high", "urgent"].map(
              (value) => ({ name: value, value }),
            ),
          },
          {
            type: 3,
            name: "when",
            description: "Date as YYYY-MM-DD",
            required: false,
          },
          {
            type: 5,
            name: "waiting",
            description: "Mark as waiting",
            required: false,
          },
          {
            type: 3,
            name: "waiting_reason",
            description: "What are we waiting on?",
            required: false,
          },
        ],
      },
      {
        type: 1,
        name: "move",
        description: "Move a card to a column",
        options: [
          { type: 3, name: "key", description: "Card ID", required: true },
          {
            type: 3,
            name: "column",
            description: "Column name",
            required: true,
          },
        ],
      },
      {
        type: 1,
        name: "people",
        description: "Add or remove someone from a card",
        options: [
          { type: 3, name: "key", description: "Card ID", required: true },
          {
            type: 3,
            name: "action",
            description: "Add or remove",
            required: true,
            choices: [
              { name: "add", value: "add" },
              { name: "remove", value: "remove" },
            ],
          },
          {
            type: 6,
            name: "person",
            description: "Person to add",
            required: true,
          },
        ],
      },
      {
        type: 1,
        name: "note",
        description: "Leave a note on a card",
        options: [
          { type: 3, name: "key", description: "Card ID", required: true },
          { type: 3, name: "text", description: "Your note", required: true },
        ],
      },
      {
        type: 1,
        name: "checklist",
        description: "View or change a checklist",
        options: [
          { type: 3, name: "key", description: "Card ID", required: true },
          {
            type: 3,
            name: "action",
            description: "What to do",
            required: true,
            choices: ["view", "add", "complete", "reopen"].map((value) => ({
              name: value,
              value,
            })),
          },
          {
            type: 3,
            name: "item",
            description: "Item text, number, or ID",
            required: false,
          },
        ],
      },
      {
        type: 1,
        name: "link",
        description: "Link a GitHub issue",
        options: [
          { type: 3, name: "key", description: "Card ID", required: true },
          {
            type: 3,
            name: "url",
            description: "GitHub issue URL",
            required: true,
          },
        ],
      },
    ],
  },
  {
    name: "board",
    description: "See what is happening on a board",
    type: 1,
    options: [
      {
        type: 1,
        name: "recap",
        description: "Show a short board recap",
        options: [
          {
            type: 3,
            name: "board",
            description: "Board name or ID",
            required: false,
          },
        ],
      },
    ],
  },
  {
    name: "Add to The Board",
    type: 3,
  },
] as const;
