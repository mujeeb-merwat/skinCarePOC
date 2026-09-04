import { ArrowLeft } from 'lucide-react'
import { useFlow } from '../../context/FlowContext'
import { QUIZ_QUESTIONS } from '../../types/flow'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'

export function QuizScreen() {
  const {
    answers,
    quizIndex,
    setAnswer,
    setQuizIndex,
    nextStep,
    prevStep,
  } = useFlow()

  const question = QUIZ_QUESTIONS[quizIndex]
  const isMulti = question.multiSelect === true
  const maxSelect = question.maxSelect ?? 1

  const currentValue = answers[question.id]

  const isLastQuestion = quizIndex === QUIZ_QUESTIONS.length - 1

  const handleSelect = (option: string) => {
    if (isMulti) {
      const selected = answers.concerns
      if (selected.includes(option)) {
        setAnswer('concerns', selected.filter((o) => o !== option))
      } else if (selected.length < maxSelect) {
        setAnswer('concerns', [...selected, option])
      }
    } else {
      setAnswer(question.id, option)
      if (!isLastQuestion) {
        setTimeout(() => setQuizIndex(quizIndex + 1), 200)
      }
    }
  }

  const handleContinue = () => {
    if (quizIndex < QUIZ_QUESTIONS.length - 1) {
      setQuizIndex(quizIndex + 1)
    } else {
      nextStep()
    }
  }

  const handleBack = () => {
    if (quizIndex > 0) {
      setQuizIndex(quizIndex - 1)
    } else {
      prevStep()
    }
  }

  const isSelected = (option: string) => {
    if (isMulti) return answers.concerns.includes(option)
    return currentValue === option
  }

  const canContinue = isMulti
    ? answers.concerns.length > 0
    : currentValue !== null

  return (
    <div className="relative flex flex-col">
      <button
        type="button"
        onClick={handleBack}
        aria-label="Go back"
        className="focus-ring absolute -left-1 -top-2 rounded-full p-2 text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <p className="text-center text-[13px] text-ink-muted">
        Question {quizIndex + 1} of {QUIZ_QUESTIONS.length}
      </p>

      <h1 className="mt-4 font-display text-[28px] font-bold leading-[1.15] text-ink md:text-[32px]">
        {question.question}
      </h1>

      {isMulti && (
        <p className="mt-2 text-[13px] text-ink-muted">
          Pick up to {maxSelect}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2.5">
        {question.options.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={isSelected(option)}
            onClick={() => handleSelect(option)}
          />
        ))}
      </div>

      {(isMulti || isLastQuestion) && (
        <Button
          className="mt-8 w-full"
          onClick={handleContinue}
          disabled={!canContinue}
        >
          Continue
        </Button>
      )}
    </div>
  )
}
