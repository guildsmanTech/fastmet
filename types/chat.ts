export type ConversationResponse = {
  _id: string;
  lastMessage: string;
  lastMessageBy: "client" | "driver";
  lastMessageAt: string;
  hasActiveBooking?: boolean;

  participantId: string;
  unreadCount: {
    client: number;
    driver: number;
  };
  driver: {
    _id: string;
    firstName: string;
    lastName: string;
    profilePictureUrl?: string;
    phoneNumber: string;
  };
};

export type MessageResponse = {
  _id: string;
  hasActiveBooking?: boolean;
  driver: {
    _id: string;
    firstName: string;
    lastName: string;
    profilePictureUrl?: string;
    phoneNumber: string;
    gender?: "male" | "female";
  };
};

export interface MessagesLoadedData {
  messages: any[];
  skip: number;
  hasMore: boolean;
}
