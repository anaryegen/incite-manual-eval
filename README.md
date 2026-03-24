# Citation Evaluation Tool

A web interface for evaluating LLM-generated answers against supporting citations.

## Setup

```bash
npm install
```

## Running

Start both frontend and backend:

```bash
npm start
```

Or run them separately:

```bash
# Frontend (port 5173)
npm run dev

# Backend (port 3001)
npm run server
```

Open http://localhost:5173 in your browser.

## How It Works

1. Each question is displayed with its generated answer
2. Citations in the answer are highlighted — the active citation's statement is shown in blue, the citation tag in yellow
3. The source document is shown below with the snippet highlighted in yellow
4. For each citation, answer two Yes/No questions:
   - Does the snippet support the statement?
   - Does the snippet support the answer to the question?
5. Navigate through all citations using Previous/Next buttons
6. After evaluating all citations, enter your User ID and submit

**Keyboard shortcuts:** `Y` = Yes, `N` = No, `←` `→` = Navigate

## Loading New Data

Replace `public/human_evaluation_data.json` with your data file using the same JSON format.

## Response Storage

Responses are saved to the `responses/` directory as JSON files named `<userId>_<timestamp>.json`.

If the backend is unavailable, responses are downloaded as a JSON file instead.
