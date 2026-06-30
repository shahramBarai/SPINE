import { SignInForm } from "components/complex/auth/SignInForm";
import { DevSignInForm } from "components/complex/auth/DevSignInForm";

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
                <img
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

export { AuthPage };
