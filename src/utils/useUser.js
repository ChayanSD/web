import * as React from "react";
import { useSession } from "@auth/create/react";

const useUser = () => {
  const { data: session, status } = useSession();
  const id = session?.user?.id;

  const [user, setUser] = React.useState(session?.user ?? null);

  const fetchUser = React.useCallback(async (session) => {
    if (!session?.user?.id) return session?.user;

    try {
      const response = await fetch("/api/auth/token");
      if (response.ok) {
        const data = await response.json();
        return data.user;
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }

    return session?.user;
  }, []);

  const refetchUser = React.useCallback(() => {
    if (id) {
      fetchUser(session).then(setUser);
    } else {
      setUser(null);
    }
  }, [fetchUser, id, session]);

  React.useEffect(() => {
    refetchUser();
  }, [refetchUser]);

  const isProduction = process.env.NEXT_PUBLIC_CREATE_ENV === "PRODUCTION";
  const userData = isProduction ? user : user;
  const isLoading =
    status === "loading" || (status === "authenticated" && !user);

  return {
    user: userData,
    data: userData,
    loading: isLoading,
    refetch: refetchUser,
  };
};

export { useUser };

export default useUser;
