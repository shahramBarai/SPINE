import { getIronSession, IronSessionData, SessionOptions } from "iron-session";
import { IncomingMessage, ServerResponse } from "http";

export const sessionOptions: SessionOptions = {
  password:
    process.env.SECRET_COOKIE_PASSWORD ||
    "complex_password_at_least_32_characters_long",
  cookieName: "webapp_auth_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    httpOnly: true,
  },
};

// Type for user session
export interface UserSession {
  id: string;
  fullName: string;
  email: string;
  avatar: string;
}

// Add user session to iron-session
declare module "iron-session" {
  interface IronSessionData {
    data: {
      user?: UserSession;
    };
  }
}

export async function getServerSession(
  req: IncomingMessage,
  res: ServerResponse
) {
  return await getIronSession<IronSessionData>(req, res, sessionOptions);
}
