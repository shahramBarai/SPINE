import AppLayout from "@/client/layout/layout";
import { withAuthSSR } from "@/server/auth/authenticated-ssr";

const DashboardPage = () => {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-foreground mb-6">
                Dashboard
            </h1>
            <div className="text-center text-muted-foreground">
                <p>Welcome to the IoT Platform Dashboard</p>
                <p className="text-sm mt-2">
                    Your platform overview will appear here
                </p>
            </div>
        </div>
    );
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
                user
            }
        };
    }
});
