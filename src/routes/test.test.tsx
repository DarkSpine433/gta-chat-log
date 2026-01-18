import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/test/test')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/test/test"!</div>
}
