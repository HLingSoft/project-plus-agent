import app from './app.ts'
const server = app.listen(Number(process.env.PORT ?? 3001), '127.0.0.1', () => {
  const address = server.address()
  if (address && typeof address !== 'string') console.log(`Project+ model proxy: http://127.0.0.1:${address.port}`)
})
