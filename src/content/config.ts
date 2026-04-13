import { defineCollection, z } from "astro:content";

const eventsCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    startTime: z.string(), // ISO 8601 datetime string
    endTime: z.string(), // ISO 8601 datetime string
    location: z.object({
      lat: z.number(),
      lng: z.number(),
      name: z.string(),
    }),
    participants: z.array(z.string()).default([]),
  }),
});

export const collections = {
  events: eventsCollection,
};
