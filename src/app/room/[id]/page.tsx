'use client';

import { PokerRoom } from "@/components/PokerRoom";
import { useUser } from "@/components/UserContext";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";

export default function RoomPage() {
  const { username, isLoading } = useUser();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    if (!isLoading && !username) {
      router.push('/');
    }
  }, [username, isLoading, router]);

  if (isLoading || !username) {
    return (
        <div className="container mt-4">
          <div className="alert alert-info">Loading...</div>
        </div>
    );
  }

  return (
     <PokerRoom teamId={id} />
  );
}
