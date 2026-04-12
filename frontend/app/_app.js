import { SessionProvider } from 'next-auth/react'
import dynamic from 'next/dynamic'

const App = ({ Component, pageProps: { session, ...pageProps } }) => {
    return (
        <SessionProvider session={session}>
            <Component {...pageProps} />
        </SessionProvider>
    )
}

export default dynamic(() => Promise.resolve(App), {
    ssr: false
})
