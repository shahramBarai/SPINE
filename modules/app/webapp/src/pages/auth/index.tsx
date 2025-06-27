import { SignInForm } from "@/client/components/complex/auth/SignInForm";
import { DevSignInForm } from "@/client/components/complex/auth/DevSignInForm";
import Image from "next/image";
import { getServerSession } from "@/server/auth/iron-session";
import { GetServerSidePropsContext } from "next";

interface AuthPageProps {
  isDevelopment: boolean;
}

const AuthPage = ({ isDevelopment }: AuthPageProps) => {
  return (
    <div className="flex flex-col xl:flex-row items-center justify-center h-screen">
      {/* Left | Top side - Form */}
      <div className="w-full flex items-center justify-center py-56 xl:py-0">
        {isDevelopment ? <DevSignInForm /> : <SignInForm />}
      </div>

      {/* Right side - Image */}
      <div className="relative w-full h-full">
        <Image
          className="absolute inset-0 object-cover w-full h-full"
          src="/myllypuron-kampus-ilmakuva.jpg"
          alt="Myllypuro campus image"
          width={1000}
          height={1000}
        />
      </div>
    </div>
  );
};

export default AuthPage;

export const getServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const session = await getServerSession(context.req, context.res);

  if (session.data?.user) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  return {
    props: {
      isDevelopment: process.env.NODE_ENV === "development",
    },
  };
};
