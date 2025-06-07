import AppLayout from "@/client/layout/layout";
import { withAuthSSR } from "@/server/auth/authenticated-ssr";

const DashboardPage = () => {
  return <div className="text-center py-4">Dashboard</div>;
};

DashboardPage.getLayout = function getLayout(page: React.ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};

export default DashboardPage;

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
