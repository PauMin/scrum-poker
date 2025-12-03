'use client';

import Join from "@/components/Join";
import { useUser } from "@/components/UserContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { username, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
        const storedTeamId = sessionStorage.getItem('teamId');
        if (storedTeamId && username) {
          router.push(`/room/${storedTeamId}`);
        }
    }
  }, [username, isLoading, router]);

  if (isLoading) return null; // Or a loading spinner

  return (
    <Join />
  );
}