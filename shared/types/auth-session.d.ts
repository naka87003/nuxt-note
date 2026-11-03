declare module "#auth-utils" {
  interface User {
    id: string;
    githubLogin: string;
    name: string;
    avatarUrl: string;
  }
}

export {};
