import React from "react"

/** Whether the card is the one in view, so a card can fold back what the user opened
 *  in it once they swipe away. A card outside the carousel is always in view. */
export const BulletinCarouselItemContext = React.createContext({ isActive: true })
