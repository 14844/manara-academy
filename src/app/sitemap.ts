import { MetadataRoute } from 'next'
import { adminDb } from '@/lib/firebase/admin'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://manara-academy.vercel.app'
  const currentDate = new Date().toISOString()

  // Static Public Pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/courses`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/labs`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // Dynamic Course Pages from Firestore
  try {
    const coursesSnap = await adminDb.collection('courses').where('status', '==', 'published').get()
    const courseRoutes: MetadataRoute.Sitemap = coursesSnap.docs.map((doc) => {
      const data = doc.data()
      return {
        url: `${baseUrl}/courses/${doc.id}`,
        lastModified: data.updated_at || currentDate,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }
    })

    return [...staticRoutes, ...courseRoutes]
  } catch (err) {
    console.error('Error fetching dynamic course sitemaps:', err)
    return staticRoutes
  }
}
