export type AnnouncementItem =
  | {
      source: "news";
      _id: string;
      title: string;
      excerpt: string;
      heroImage: string;
      tag: "Announcement" | "Drivers" | "Users" | "Guide" | "Updates";
      readTime: number;
      createdAt: string;
      isRead: boolean;
    }
  | {
      source: "announcement";
      _id: string;
      title: string;
      message: string;
      type: string;
      isRead: boolean;
      createdAt: string;
    };
