export interface OSMJson {
  type: string
  id: number
  lat: number
  lon: number
  timestamp: string
  version: number
  changeset: number
  user: string
  uid: number
  tags: {
    [key: string]: string
  }
}

interface Issue {
  description: string
  severity: number
  type: string
}

interface Area {
  id: number
  url_alias: string
}

interface ITags {
  "icon:android": string
  "category": string
  "areas": Area[]
  "issues"?: Issue[]
}

export interface IbtcmapElement {
  id: string
  osm_json: OSMJson
  tags: ITags
  created_at: string
  updated_at: string
  deleted_at: string
}

export type OSMbtcMap = IbtcmapElement

export interface IMarker {
  id: string
  location: {
    latitude: number
    longitude: number
    tags: {
      [key: string]: string
    }
  }
  tags: ITags
}

export interface ICluster {
  clusterId: number
  coordinate: {
    latitude: number
    longitude: number
  }
  pointCount: number
}
