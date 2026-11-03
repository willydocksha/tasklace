// github and google sign-in (oauth 2 authorization code flow)

export type Profile = { id: string; email: string; name: string; avatar?: string };

type Provider = {
  label: string;
  authorize: string;
  scope: string;
  clientId?: string;
  clientSecret?: string;
  // exchange the code and return a verified email profile
  profile: (code: string, redirectUri: string, p: Provider) => Promise<Profile>;
};

// post a form and read json back
async function postForm(url: string, data: Record<string, string>) {
  const r = await fetch(url, { method: "POST", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(data) });
  if (!r.ok) throw new Error(`token exchange failed (${r.status})`);
  return r.json();
}

export const PROVIDERS: Record<string, Provider> = {
  github: {
    label: "GitHub",
    authorize: "https://github.com/login/oauth/authorize",
    scope: "read:user user:email",
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    async profile(code, redirectUri, p) {
      const tok = await postForm("https://github.com/login/oauth/access_token", { client_id: p.clientId!, client_secret: p.clientSecret!, code, redirect_uri: redirectUri });
      if (!tok.access_token) throw new Error("github: no access token");
      const h = { authorization: `Bearer ${tok.access_token}`, accept: "application/vnd.github+json", "user-agent": "tasklace" };
      const [u, emails] = await Promise.all([fetch("https://api.github.com/user", { headers: h }).then((r) => r.json()), fetch("https://api.github.com/user/emails", { headers: h }).then((r) => r.json())]);
      // only a verified address can link to an existing account
      const list = Array.isArray(emails) ? (emails as { email: string; primary: boolean; verified: boolean }[]) : [];
      const email = (list.find((e) => e.primary && e.verified) ?? list.find((e) => e.verified))?.email;
      if (!email) throw new Error("github: no verified email");
      return { id: String(u.id), email, name: u.name || u.login, avatar: u.avatar_url };
    },
  },
  google: {
    label: "Google",
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid email profile",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    async profile(code, redirectUri, p) {
      const tok = await postForm("https://oauth2.googleapis.com/token", { client_id: p.clientId!, client_secret: p.clientSecret!, code, redirect_uri: redirectUri, grant_type: "authorization_code" });
      if (!tok.access_token) throw new Error("google: no access token");
      const u = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
      if (!u.email || !u.email_verified) throw new Error("google: no verified email");
      return { id: String(u.sub), email: u.email, name: u.name || u.email.split("@")[0], avatar: u.picture };
    },
  },
};

// providers that have credentials configured, for the login buttons
export const enabledProviders = () =>
  Object.entries(PROVIDERS)
    .filter(([, p]) => p.clientId && p.clientSecret)
    .map(([id, p]) => ({ id, label: p.label }));
