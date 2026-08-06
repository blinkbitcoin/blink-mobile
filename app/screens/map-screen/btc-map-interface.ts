import { Category } from "@app/components/map-components/categories.ts"

export interface IMarker {
  name: string | null
  id: number
  icon: string
  category: Category | null
  location: {
    latitude: number
    longitude: number
  }
  tags: {
    [key: string]: string
  } | null
}
