import NextAuth from 'next-auth';
import KakaoProvider from 'next-auth/providers/kakao';

const handler = NextAuth({
    providers: [
        KakaoProvider({
            clientId: process.env.KAKAO_CLIENT_ID,
            clientSecret: process.env.KAKAO_CLIENT_SECRET,
        }),
    ],
    callbacks: {
        async session({ session, token }) {
            console.log('session', session);
            session.JSESSIONID = token.JSESSIONID;
            return session;
        },
    },
});

export { handler as GET, handler as POST };
