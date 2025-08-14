import type { ChangeEvent } from 'react'
import useVocabAnswer from './useVocabAnswer'

const TextInput = () => {
  const { answer, setAnswer } = useVocabAnswer()

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAnswer(e.target.value)
  }

  return <input type="text" value={answer} onChange={handleChange} />
}

export default TextInput
