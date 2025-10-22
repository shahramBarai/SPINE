import {
  GetServerSidePropsContext,
  GetServerSidePropsResult,
  PreviewData,
} from "next";
import { ParsedUrlQuery } from "querystring";
import { getServerSession } from "./iron-session";
import { UserSession } from "./iron-session";

// Enhanced context with authenticated user data
export interface AuthenticatedContext<
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData
> extends GetServerSidePropsContext<Params, Preview> {
  req: GetServerSidePropsContext["req"] & {
    session: {
      data: { user: UserSession };
    };
  };
}

// Type for authenticated getServerSideProps functions
export type AuthenticatedGetServerSideProps<
  P extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData
> = (
  context: AuthenticatedContext<Params, Preview>
) => Promise<GetServerSidePropsResult<P>>;

/**
 * Wraps a getServerSideProps function to ensure the user is authenticated
 * before rendering the page.
 *
 * @param opts Configuration options
 * @param opts.handler The getServerSideProps function to wrap
 * @param opts.redirectTo The URL to redirect to if the user is not authenticated
 * @returns A getServerSideProps function that checks authentication
 */
export function withAuthSSR<Props>(opts: {
  handler: AuthenticatedGetServerSideProps<
    Props extends Record<string, unknown> ? Props : never
  >;
  redirectTo?: string;
}) {
  return async function authenticatedHandler(
    context: GetServerSidePropsContext
  ): Promise<GetServerSidePropsResult<Props>> {
    // Get the user session
    const session = await getServerSession(context.req, context.res);

    const user = session.data.user;
    if (!user) {
      return {
        redirect: {
          destination: opts.redirectTo ?? "/auth",
          permanent: false,
        },
      };
    }

    // Add the user to the context and call the handler
    const authenticatedContext = {
      ...context,
      req: {
        ...context.req,
        session: {
          data: { user: user },
        },
      },
    } as AuthenticatedContext;

    return opts.handler(authenticatedContext);
  };
}

/**
 * Example usage:
 *
 * export const getServerSideProps = withAuthSSR({
 *   handler: async (ctx) => {
 *     // ctx.user is guaranteed to be available here
 *     return {
 *       props: {
 *         userData: ctx.user,
 *         // ... other props
 *       }
 *     }
 *   }
 * });
 */
