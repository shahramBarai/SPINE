import { withAuthSSR } from "@/server/auth/authenticated-ssr";
import AppLayout from "../client/layout/layout";

function Home() {
  return <div className="text-center py-4">Home</div>;
}

Home.getLayout = function getLayout(page: React.ReactNode) {
  return <AppLayout>{page}</AppLayout>;
};

export default Home;

export const getServerSideProps = withAuthSSR({
  handler: async (ctx) => {
    const user = ctx.req.session.data;

    return {
      props: {
        user,
      },
    };
  },
});
