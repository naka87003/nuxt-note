import { sendRedirect } from "nuxt/server";
import { getPrisma } from "../../utils/prisma";

export default defineOAuthGitHubEventHandler({
  config: { emailRequired: false },
  async onSuccess(event, { user }) {
    const data = {
      githubLogin: user.login,
      name: user.name || user.login,
      avatarUrl: user.avatar_url,
    };
    const account = await getPrisma().user.upsert({
      where: { githubId: String(user.id) },
      create: { githubId: String(user.id), ...data },
      update: data,
    });
    await replaceUserSession(event, {
      user: {
        id: account.id,
        githubLogin: account.githubLogin,
        name: account.name,
        avatarUrl: account.avatarUrl ?? "",
      },
    });
    return sendRedirect(event, "/notes");
  },
  onError(event) {
    console.warn("GitHub sign-in could not be completed.");
    return sendRedirect(event, "/login?error=github");
  },
});
