import { render, screen } from '@testing-library/react'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders the instructional message', () => {
    render(<EmptyState />)
    expect(screen.getByText(/press record/i)).toBeInTheDocument()
  })

  it('contains text about recording', () => {
    render(<EmptyState />)
    expect(screen.getByText(/first loop/i)).toBeInTheDocument()
  })
})
