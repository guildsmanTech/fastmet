export type ConversationResponse = {
  _id: string;
  lastMessage: string;
  lastMessageBy: "client" | "driver";
  lastMessageAt: string;
  hasActiveBooking?: boolean;

  unreadCount: {
    client: number;
    driver: number;
  };
  driver: {
    _id: string;
    firstName: string;
    lastName: string;
    profilePictureUrl?: string;
  };
};

export type MessageResponse = {
  _id: string;
  hasActiveBooking?: boolean;
  /** Refs of the bookings this driver is working on for you, oldest first. */
  activeBookingRefs?: string[];
  driver: {
    _id: string;
    firstName: string;
    lastName: string;
    profilePictureUrl?: string;
    /** Only sent while the chat is open (active booking). */
    phoneNumber?: string;
    gender?: "male" | "female";
  };
};

/** A message as the server sends it (socket acks, `receive_message`, image upload). */
export type ChatMessage = {
  _id: string;
  conversationId: string;
  senderId: string;
  senderType: "client" | "driver";
  text: string;
  image: string | null;
  createdAt: string;
  clientMessageId: string | null;
};

/** Where a chat is open: the full message screen or a modal over another screen. */
export type ChatSurface = "screen" | "modal";
