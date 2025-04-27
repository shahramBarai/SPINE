import AppLayout from "../client/layout/layout";

function Home() {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold">Hello World</h1>
      <p className="text-lg mt-4">This is a test page.</p>
    </div>
  );
}

Home.getLayout = function getLayout(page: React.ReactNode) {
  return <AppLayout>{page}</AppLayout>;
};

export default Home;
