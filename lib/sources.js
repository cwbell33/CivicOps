export const GROUPS = ["Housing & Urbanism", "Transit & Streets", "Volunteering", "Government & Political", "Suburban Councils"];

// url:      page a person opens to see the calendar (shown as a link in the app).
// checkUrl: what the scheduled local refresh reads. Only sources that have one
//           are checked. Some are data feeds rather than pages, and may contain
//           placeholders the refresh fills in: {today} (YYYY-MM-DD), {year}.
//           Legistar and CivicClerk feeds return JSON; CivicClerk times are UTC.
// Sources with no checkUrl have no calendar that can be read automatically.
export const DEFAULT_SOURCES = [
  // No current events page: its events tag is an archive ending in 2018.
  { name: "Sightline Institute", group: "Housing & Urbanism", url: "" },
  { name: "The Urbanist", group: "Housing & Urbanism", url: "https://www.theurbanist.org/tag/events/", checkUrl: "https://www.theurbanist.org/tag/events/" },
  // Events calendar is empty and unchanged since 2024.
  { name: "Futurewise", group: "Housing & Urbanism", url: "" },
  // Posts events only to Eventbrite and Facebook, neither of which can be read.
  { name: "Share the Cities", group: "Housing & Urbanism", url: "https://sharethecities.org/events-resources" },
  // Appears dormant: no posts since 2021.
  { name: "Seattle For Everyone", group: "Housing & Urbanism", url: "" },
  { name: "House Our Neighbors", group: "Housing & Urbanism", url: "https://www.houseourneighbors.org/events", checkUrl: "https://www.houseourneighbors.org/events" },

  { name: "Transportation Choices Coalition", group: "Transit & Streets", url: "https://transportationchoices.org/events/", checkUrl: "https://transportationchoices.org/events/" },
  { name: "Sound Transit (board & public meetings)", group: "Transit & Streets", url: "https://www.soundtransit.org/get-to-know-us/news-events/calendar", checkUrl: "https://www.soundtransit.org/get-to-know-us/news-events/calendar" },
  // Calendar loads with JavaScript, so it can't be read automatically.
  { name: "Seattle Streets Alliance (formerly Seattle Neighborhood Greenways)", group: "Transit & Streets", url: "https://www.streetsalliance.org/get-involved/calendar/" },

  { name: "Habitat for Humanity Seattle-King County", group: "Volunteering", url: "https://www.habitatskc.org/news-events/events/", checkUrl: "https://www.habitatskc.org/news-events/events/" },
  { name: "United Way of King County", group: "Volunteering", url: "https://www.uwkc.org/events/category/volunteer/", checkUrl: "https://www.uwkc.org/events/category/volunteer/" },
  // Now redirects to Idealist, whose Seattle results are mostly off-topic and outside King County.
  { name: "VolunteerMatch (Seattle)", group: "Volunteering", url: "" },

  { name: "Seattle City Council", group: "Government & Political", url: "https://seattle.legistar.com/Calendar.aspx", checkUrl: "https://webapi.legistar.com/v1/seattle/events?$filter=EventDate ge datetime'{today}'&$orderby=EventDate&$top=50" },
  { name: "King County Council", group: "Government & Political", url: "https://mkcclegisearch.kingcounty.gov/Calendar.aspx", checkUrl: "https://webapi.legistar.com/v1/kingcounty/events?$filter=EventDate ge datetime'{today}'&$orderby=EventDate&$top=50" },
  // Calendar loads with JavaScript and exposes no feed.
  { name: "King County Democrats", group: "Government & Political", url: "https://www.kcdems.org/events/" },

  { name: "Bellevue City Council", group: "Suburban Councils", url: "https://bellevue.legistar.com/Calendar.aspx", checkUrl: "https://webapi.legistar.com/v1/bellevue/events?$filter=EventDate ge datetime'{today}'&$orderby=EventDate&$top=50" },
  { name: "Redmond City Council", group: "Suburban Councils", url: "https://redmond.legistar.com/Calendar.aspx", checkUrl: "https://webapi.legistar.com/v1/redmond/events?$filter=EventDate ge datetime'{today}'&$orderby=EventDate&$top=50" },
  { name: "Kirkland City Council", group: "Suburban Councils", url: "https://www.kirklandwa.gov/Government/City-Council/Council-Meeting-Minutes-and-Agendas", checkUrl: "https://www.kirklandwa.gov/Government/City-Council/Council-Meeting-Minutes-and-Agendas" },
  // Covers only the coming week, but lists agenda topics.
  { name: "Renton City Council", group: "Suburban Councils", url: "https://rentonwa.gov/Government/City-Council/City-Council-Meetings/weeklyagendas", checkUrl: "https://rentonwa.gov/Government/City-Council/City-Council-Meetings/weeklyagendas" },
  { name: "Kent City Council", group: "Suburban Councils", url: "https://kentwa.iqm2.com/Citizens/default.aspx", checkUrl: "https://kentwa.iqm2.com/Citizens/default.aspx" },
  { name: "Auburn City Council", group: "Suburban Councils", url: "https://www.auburnwa.gov/city_hall/public_meetings", checkUrl: "https://www.auburnwa.gov/city_hall/public_meetings" },
  { name: "Federal Way City Council", group: "Suburban Councils", url: "https://www.federalwaywa.gov/page/agendas-and-minutes", checkUrl: "https://www.federalwaywa.gov/page/agendas-and-minutes" },
  { name: "Shoreline City Council", group: "Suburban Councils", url: "https://shoreline.granicus.com/ViewPublisher.php?view_id=4", checkUrl: "https://shoreline.granicus.com/ViewPublisher.php?view_id=4" },
  { name: "Burien City Council", group: "Suburban Councils", url: "https://burienwa.civicweb.net/Portal/MeetingTypeList.aspx", checkUrl: "https://burienwa.civicweb.net/Portal/MeetingTypeList.aspx" },
  { name: "Issaquah City Council", group: "Suburban Councils", url: "https://www.issaquahwa.gov/calendar.aspx?CID=36", checkUrl: "https://www.issaquahwa.gov/calendar.aspx?CID=36" },
  { name: "Sammamish City Council", group: "Suburban Councils", url: "https://www.sammamish.us/government/city-council/", checkUrl: "https://www.sammamish.us/news/events/{year}-city-council-meetings/" },
  { name: "Bothell City Council", group: "Suburban Councils", url: "https://www.bothellwa.gov/AgendaCenter/City-Council-5", checkUrl: "https://www.bothellwa.gov/AgendaCenter/City-Council-5" },
  { name: "Kenmore City Council", group: "Suburban Councils", url: "https://kenmorewa.portal.civicclerk.com/", checkUrl: "https://kenmorewa.api.civicclerk.com/v1/Events?$filter=startDateTime ge {today}T00:00:00Z&$orderby=startDateTime&$top=20" },
  { name: "Mercer Island City Council", group: "Suburban Councils", url: "https://www.mercerisland.gov/meetings?field_microsite_tid_1=27", checkUrl: "https://www.mercerisland.gov/meetings?field_microsite_tid_1=27" },
];
