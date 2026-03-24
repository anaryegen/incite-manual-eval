import { useState, useEffect, useCallback } from 'react'
import './App.css'

// Parse the generated answer to extract segments (text + citation references)
function parseAnswer(answer, citations) {
  const citationRegex = /\[doc:(\d+)\s+snippet:"([^"]*?)"\]/g
  const segments = []
  let lastIndex = 0
  let match
  // Track which citation we're on per doc_id for ordered matching
  const docIdOccurrences = {}

  while ((match = citationRegex.exec(answer)) !== null) {
    const fullMatch = match[0]
    const docId = match[1]
    const matchStart = match.index

    // Match citations by doc_id in order of appearance
    if (!docIdOccurrences[docId]) docIdOccurrences[docId] = 0
    const occurrence = docIdOccurrences[docId]
    const matchingIndices = citations
      .map((c, i) => (c.doc_id === docId ? i : -1))
      .filter((i) => i >= 0)
    const citIndex = matchingIndices[occurrence] ?? matchingIndices[0] ?? -1
    docIdOccurrences[docId]++

    // Text before this citation — this is the "statement"
    // Find where the previous citation or sentence boundary ends
    const textBefore = answer.substring(lastIndex, matchStart)

    // Split textBefore to isolate the statement (text after last period/start)
    const sentenceMatch = textBefore.match(/(.*?)([^.]*$)/s)
    if (sentenceMatch) {
      const prefix = sentenceMatch[1]
      const statement = sentenceMatch[2]
      if (prefix) {
        segments.push({ type: 'text', content: prefix })
      }
      if (statement) {
        segments.push({ type: 'statement', content: statement, citationIndex: citIndex })
      }
    }

    segments.push({
      type: 'citation',
      content: fullMatch,
      citationIndex: citIndex,
      docId,
    })

    lastIndex = match.index + fullMatch.length
  }

  // Remaining text after last citation
  if (lastIndex < answer.length) {
    segments.push({ type: 'text', content: answer.substring(lastIndex) })
  }

  return segments
}

function HighlightedAnswer({ segments, activeCitationIndex }) {
  return (
    <div className="answer-text">
      {segments.map((seg, i) => {
        if (seg.type === 'statement') {
          const isActive = seg.citationIndex === activeCitationIndex
          return (
            <span
              key={i}
              className={`statement-highlight ${isActive ? 'active' : ''}`}
            >
              {seg.content}
            </span>
          )
        }
        if (seg.type === 'citation') {
          const isActive = seg.citationIndex === activeCitationIndex
          return (
            <span
              key={i}
              className={`citation-highlight ${isActive ? 'active' : ''}`}
              title={`Citation from doc ${seg.docId}`}
            >
              [Citation {seg.citationIndex + 1}]
            </span>
          )
        }
        return <span key={i}>{seg.content}</span>
      })}
    </div>
  )
}

function DocumentViewer({ citation }) {
  if (!citation) return null
  const { snippet, full_document, doc_id } = citation

  // If full_document is empty, just show the snippet
  const docText = full_document || snippet

  // Highlight snippet within document
  const snippetIndex = docText.indexOf(snippet)

  let parts
  if (snippetIndex >= 0) {
    parts = [
      { text: docText.substring(0, snippetIndex), highlighted: false },
      { text: docText.substring(snippetIndex, snippetIndex + snippet.length), highlighted: true },
      { text: docText.substring(snippetIndex + snippet.length), highlighted: false },
    ]
  } else {
    parts = [{ text: docText, highlighted: false }]
  }

  return (
    <div className="document-viewer">
      <h3>Source Document <span className="doc-id">(PMID: {doc_id})</span></h3>
      <div className="document-text">
        {parts.map((part, i) =>
          part.highlighted ? (
            <mark key={i} className="snippet-highlight">{part.text}</mark>
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </div>
    </div>
  )
}

function EvalButtons({ label, value, onChange }) {
  return (
    <div className="eval-question">
      <p className="eval-label">{label}</p>
      <div className="button-group">
        <button
          className={`eval-btn yes ${value === 'yes' ? 'selected' : ''}`}
          onClick={() => onChange('yes')}
        >
          Yes
        </button>
        <button
          className={`eval-btn no ${value === 'no' ? 'selected' : ''}`}
          onClick={() => onChange('no')}
        >
          No
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [data, setData] = useState([])
  const [exampleIndex, setExampleIndex] = useState(0)
  const [citationIndex, setCitationIndex] = useState(0)
  const [responses, setResponses] = useState({})
  const [userId, setUserId] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    fetch('/human_evaluation_data.json')
      .then((r) => r.json())
      .then(setData)
      .catch((e) => console.error('Failed to load data:', e))
  }, [])

  const example = data[exampleIndex]
  const citation = example?.citations[citationIndex]
  const totalCitations = example?.citations.length || 0
  const segments = example ? parseAnswer(example.generated_answer, example.citations) : []

  // Response key for current citation
  const responseKey = `${exampleIndex}-${citationIndex}`
  const currentResponse = responses[responseKey] || {}

  const setAnswer = (question, value) => {
    setResponses((prev) => ({
      ...prev,
      [responseKey]: { ...prev[responseKey], [question]: value },
    }))
  }

  // Check if all evaluations are complete
  const allComplete = data.length > 0 && data.every((ex, ei) =>
    ex.citations.every((_, ci) => {
      const key = `${ei}-${ci}`
      return responses[key]?.q1 && responses[key]?.q2
    })
  )

  // Navigation
  const canGoNext = citationIndex < totalCitations - 1 || exampleIndex < data.length - 1
  const canGoPrev = citationIndex > 0 || exampleIndex > 0

  const goNext = () => {
    if (citationIndex < totalCitations - 1) {
      setCitationIndex(citationIndex + 1)
    } else if (exampleIndex < data.length - 1) {
      setExampleIndex(exampleIndex + 1)
      setCitationIndex(0)
    }
  }

  const goPrev = () => {
    if (citationIndex > 0) {
      setCitationIndex(citationIndex - 1)
    } else if (exampleIndex > 0) {
      const prevEx = data[exampleIndex - 1]
      setExampleIndex(exampleIndex - 1)
      setCitationIndex(prevEx.citations.length - 1)
    }
  }

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e) => {
      if (submitted) return
      if (e.target.tagName === 'INPUT') return
      if (e.key === 'y' || e.key === 'Y') {
        if (!currentResponse.q1) setAnswer('q1', 'yes')
        else if (!currentResponse.q2) setAnswer('q2', 'yes')
      }
      if (e.key === 'n' || e.key === 'N') {
        if (!currentResponse.q1) setAnswer('q1', 'no')
        else if (!currentResponse.q2) setAnswer('q2', 'no')
      }
      if (e.key === 'ArrowRight' && canGoNext) goNext()
      if (e.key === 'ArrowLeft' && canGoPrev) goPrev()
    },
    [currentResponse, canGoNext, canGoPrev, submitted]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Compute overall progress
  const totalEvals = data.reduce((sum, ex) => sum + ex.citations.length, 0)
  const completedEvals = Object.values(responses).filter((r) => r.q1 && r.q2).length

  // Replace with your deployed Google Apps Script URL
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6kw6FQpFjayQhcWs9kj-InL9KLUOo5pU_Opsy-KJ_ryvLN4GTJ8SuVpJSJdC3FbFMDQ/exec'

  const handleSubmit = async () => {
    if (!userId.trim()) {
      setSubmitError('Please enter your User ID')
      return
    }

    // Format responses for submission
    const formattedResponses = []
    data.forEach((ex, ei) => {
      ex.citations.forEach((cit, ci) => {
        const key = `${ei}-${ci}`
        const r = responses[key] || {}
        formattedResponses.push({
          question: ex.question,
          citationIndex: ci,
          docId: cit.doc_id,
          q1_support: r.q1 || null,
          q2_relevance: r.q2 || null,
        })
      })
    })

    const payload = {
      userId: userId.trim(),
      timestamp: new Date().toISOString(),
      responses: formattedResponses,
    }

    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload),
      })
      setSubmitted(true)
      setSubmitError('')
    } catch (err) {
      setSubmitError('Failed to save to Google Drive. Please try again.')
      console.error('Submit error:', err)
    }
  }

  if (data.length === 0) {
    return <div className="loading">Loading evaluation data...</div>
  }

  if (submitted) {
    return (
      <div className="container confirmation">
        <h1>Thank you!</h1>
        <p>Your evaluation has been submitted successfully.</p>
        <p className="summary">{completedEvals} of {totalEvals} citations evaluated.</p>
      </div>
    )
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Citation Evaluation</h1>
        <div className="progress">
          Progress: {completedEvals} / {totalEvals} citations evaluated
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${totalEvals ? (completedEvals / totalEvals) * 100 : 0}%` }}
            />
          </div>
        </div>
      </header>

      <section className="section question-section">
        <h2>Question {exampleIndex + 1} of {data.length}</h2>
        <p className="question-text">{example.question}</p>
      </section>

      <section className="section answer-section">
        <h2>Generated Answer</h2>
        <HighlightedAnswer segments={segments} activeCitationIndex={citationIndex} />
      </section>

      <section className="section citation-nav-section">
        <div className="citation-nav">
          <button onClick={goPrev} disabled={!canGoPrev} className="nav-btn">
            &larr; Previous
          </button>
          <span className="citation-counter">
            Citation {citationIndex + 1} of {totalCitations}
            {data.length > 1 && ` (Question ${exampleIndex + 1}/${data.length})`}
          </span>
          <button onClick={goNext} disabled={!canGoNext} className="nav-btn">
            Next &rarr;
          </button>
        </div>
      </section>

      <DocumentViewer citation={citation} />

      <section className="section eval-section">
        <h2>Evaluation</h2>
        <EvalButtons
          label="1. Does the highlighted snippet support the highlighted statement in the answer?"
          value={currentResponse.q1}
          onChange={(v) => setAnswer('q1', v)}
        />
        <EvalButtons
          label="2. Given the full document, does the snippet correctly support the answer to the question?"
          value={currentResponse.q2}
          onChange={(v) => setAnswer('q2', v)}
        />
      </section>

      {allComplete && (
        <section className="section submit-section">
          <h2>Submit Your Evaluation</h2>
          <div className="user-id-input">
            <label htmlFor="userId">Enter your User ID:</label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g. reviewer_01"
            />
          </div>
          {submitError && <p className="error">{submitError}</p>}
          <button className="submit-btn" onClick={handleSubmit}>
            Submit Evaluation
          </button>
        </section>
      )}

      <footer className="footer">
        <p>Keyboard shortcuts: <kbd>Y</kbd> Yes &middot; <kbd>N</kbd> No &middot; <kbd>&larr;</kbd> <kbd>&rarr;</kbd> Navigate</p>
      </footer>
    </div>
  )
}
