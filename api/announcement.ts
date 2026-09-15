import api from "@/lib/axios";

export const fetchAnnouncements = async (page: number, limit: number) => {
  const {data} = await api.get("/announcements", {params: {page, limit}});
  return data;
};

export const fetchAnnouncementUnreadCount = async (): Promise<{
  unreadCount: number;
}> => {
  const res = await api.get<{
    success: boolean;
    data: {unreadCount: number};
  }>("/announcements/unread-count");
  return res.data.data;
};

export const markAnnouncementAsRead = async (
  id: string,
  contentType: "news" | "announcement",
): Promise<{success: boolean; message: string}> => {
  const {data} = await api.patch(`/announcements/read/${id}`, {contentType});
  return data;
};

export const fetchNewsById = async (id: string) => {
  const {data} = await api.get(`announcements/news/${id}`);
  return data.news;
};
