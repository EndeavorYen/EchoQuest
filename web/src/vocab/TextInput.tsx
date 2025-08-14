import type { ChangeEvent } from 'react'
import useVocabAnswer from './useVocabAnswer'

const TextInput = () => {
  const { answer, setAnswer } = useVocabAnswer()

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAnswer(e.target.value)
  }

  return (
    <input
      type="text"
      value={answer}
      onChange={handleChange}
      placeholder="Type the word"
      className="px-3 py-2 rounded-lg border border-pastelPurple/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-pastelPurple/60 bg-white/90 text-gray-800"
    />
  )
}

export default TextInput
