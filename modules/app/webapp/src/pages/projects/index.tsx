import { Button } from "@/client/components/basics/Button";
import AppLayout from "@/client/layout/layout";
import { withAuthSSR } from "@/server/auth/authenticated-ssr";

function Projects() {
  return (
    <div className="text-center py-4">
      <h1>Projects</h1>
      <Button variant="primary" href="/projects/0">
        Flink pipeline example
      </Button>
    </div>
  );
}

Projects.getLayout = function getLayout(page: React.ReactNode) {
  return <AppLayout>{page}</AppLayout>;
};

export default Projects;

export const getServerSideProps = withAuthSSR({
  handler: async (ctx) => {
    return {
      props: {
        user: ctx.req.session.data,
      },
    };
  },
});
