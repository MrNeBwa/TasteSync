"""Offline fallback catalog.

The primary catalog source is TMDB, which requires a token and a reachable
network. When neither is available the API would otherwise have an empty
`movies` table and every movie session would have nothing to show, so it seeds
this small bundled set instead.

Rows written from here use `provider="bundled"` and are removed as soon as a
real TMDB sync succeeds, so provider data always wins.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True, slots=True)
class BundledMovie:
    title: str
    year: int
    overview: str
    popularity: float
    genres: tuple[tuple[str, str], ...]


def _slug(title: str, year: int) -> str:
    base = "".join(char if char.isalnum() else "-" for char in title.lower())
    while "--" in base:
        base = base.replace("--", "-")
    return f"{base.strip('-')}-{year}"


def _movie(
    title: str,
    year: int,
    overview: str,
    popularity: float,
    genres: tuple[tuple[str, str], ...],
) -> BundledMovie:
    return BundledMovie(
        title=title,
        year=year,
        overview=overview,
        popularity=popularity,
        genres=genres,
    )


BUNDLED_PROVIDER = "bundled"

# YouTube video ids for official trailer uploads, keyed by title. Every id was
# resolved through YouTube's oEmbed endpoint, so a typo or a dead video fails
# loudly instead of reaching the player as an error. Channels are the films'
# own distributors (Warner Bros., A24, Paramount, Sony, Pixar, Lionsgate,
# Universal, Searchlight) or the licensed Rotten Tomatoes trailer archive.
# These are stored as watch URLs, the same shape TMDB trailers are written in;
# the web client converts them to embed URLs in one place.
TRAILER_KEYS: dict[str, str] = {
    "The Matrix": "vKQi3bBA1y8",
    "Inception": "YoHD9XEInc0",
    "Interstellar": "zSWdZVtXT7E",
    "Parasite": "5xH0HfJHsaY",
    "Spirited Away": "ByXuk9QqQkk",
    "The Godfather": "1x0GpEZnwa8",
    "Pulp Fiction": "s7EdQ4FqbhY",
    "Fight Club": "qtRKdVHc-cE",
    "Forrest Gump": "bLvqoHBptjg",
    "The Shawshank Redemption": "PLl99DlL6b4",
    "Whiplash": "7d_jQycdQGo",
    "Blade Runner 2049": "gCcx85zbxz4",
    "Mad Max: Fury Road": "hEJnMQG9ev8",
    "The Dark Knight": "EXeTwQWrcwY",
    "Dune": "8g18jFHCLXk",
    "Everything Everywhere All at Once": "wxN1T1uxQ2g",
    "Spider-Man: Into the Spider-Verse": "g4Hbz2jLxvQ",
    "Your Name.": "xU47nhruN-Q",
    "The Social Network": "lB95KLmpLR4",
    "Gladiator": "P5ieIbInFpg",
    "Se7en": "znmZoVkCjpI",
    "Goodfellas": "2ilzidi_J8Q",
    "Alien": "2TBKRQ4OwQc",
    "The Thing": "ySvzHdtCiWE",
    "Jaws": "U1fu_sA7XhE",
    "Jurassic Park": "QWBKEmWWL38",
    "Back to the Future": "qvsgGtivCgs",
    "The Lion King": "eHcZlPpNt0Q",
    "Toy Story": "v-PjgYDrg70",
    "WALL·E": "CZ1CATNbXg0",
    "Coco": "xlnPHQ3TLX8",
    "Get Out": "DzfpyUB60YY",
    "Knives Out": "qGqiHJTsRkQ",
    "La La Land": "0pdqf4P9MB8",
    "The Grand Budapest Hotel": "1Fg5iWmQjwk",
    "Arrival": "tFMo3UJ4B4g",
    "Gravity": "OiTiKOy59o4",
    "The Prestige": "RLtaA9fFNXU",
    "Memento": "4CV41hoyS8A",
    "Upgrade": "59i1_VxdlLI",
}

YOUTUBE_WATCH_URL = "https://www.youtube.com/watch?v="

BUNDLED_CATALOG: tuple[BundledMovie, ...] = (
    _movie("The Matrix", 1999, "A hacker discovers the world he lives in is a simulation, and joins a rebellion against its controllers.", 84.2, (("878", "Science Fiction"), ("28", "Action"))),
    _movie("Inception", 2010, "A thief who steals corporate secrets through dream-sharing is offered one last job: plant an idea instead of taking one.", 86.0, (("878", "Science Fiction"), ("28", "Action"), ("53", "Thriller"))),
    _movie("Interstellar", 2014, "A former pilot leads a mission through a wormhole to find humanity a new home as Earth slowly dies.", 82.6, (("878", "Science Fiction"), ("18", "Drama"), ("12", "Adventure"))),
    _movie("Parasite", 2019, "A poor family cons its way into the household of a wealthy one, and the arrangement turns violent.", 79.4, (("53", "Thriller"), ("18", "Drama"), ("35", "Comedy"))),
    _movie("Spirited Away", 2001, "A girl wanders into a world of spirits and must work in a bathhouse to free her parents.", 80.1, (("16", "Animation"), ("14", "Fantasy"), ("10751", "Family"))),
    _movie("The Godfather", 1972, "The ageing patriarch of a New York crime dynasty tries to hand control to a son who never wanted it.", 78.9, (("80", "Crime"), ("18", "Drama"))),
    _movie("Pulp Fiction", 1994, "Interwoven stories of two hitmen, a boxer and a gangster's wife collide in Los Angeles.", 77.3, (("80", "Crime"), ("18", "Drama"))),
    _movie("Fight Club", 1999, "An insomniac office worker and a soap salesman start an underground fight club that becomes something much larger.", 76.8, (("18", "Drama"), ("53", "Thriller"))),
    _movie("Forrest Gump", 1994, "A kind-hearted man from Alabama keeps stumbling into the defining moments of American history.", 75.2, (("18", "Drama"), ("10749", "Romance"), ("35", "Comedy"))),
    _movie("The Shawshank Redemption", 1994, "A banker sentenced to life for a murder he did not commit builds a life, and a plan, inside prison.", 74.7, (("18", "Drama"), ("80", "Crime"))),
    _movie("Whiplash", 2014, "A young jazz drummer is pushed toward perfection by a conductor who believes cruelty is the price of genius.", 71.4, (("18", "Drama"), ("10402", "Music"))),
    _movie("Blade Runner 2049", 2017, "A replicant blade runner uncovers a secret buried for decades and goes looking for a man who vanished with it.", 73.1, (("878", "Science Fiction"), ("18", "Drama"), ("9648", "Mystery"))),
    _movie("Mad Max: Fury Road", 2015, "In a scorched wasteland, a drifter and a renegade commander flee a warlord's army in one endless chase.", 72.6, (("28", "Action"), ("12", "Adventure"), ("878", "Science Fiction"))),
    _movie("The Dark Knight", 2008, "Batman, Gordon and Harvey Dent try to keep Gotham stable while a criminal calling himself the Joker pushes everyone to breaking point.", 82.0, (("28", "Action"), ("80", "Crime"), ("18", "Drama"))),
    _movie("Dune", 2021, "A noble family becomes entangled in a struggle over a desert planet that produces the most valuable substance in the universe.", 79.8, (("878", "Science Fiction"), ("12", "Adventure"))),
    _movie("Everything Everywhere All at Once", 2022, "A laundromat owner mid-audit discovers she must connect with parallel versions of herself to stop a cosmic threat.", 78.4, (("878", "Science Fiction"), ("35", "Comedy"), ("28", "Action"))),
    _movie("Spider-Man: Into the Spider-Verse", 2018, "A Brooklyn teenager becomes Spider-Man and meets a handful of Spider-People from other dimensions.", 76.9, (("16", "Animation"), ("28", "Action"), ("12", "Adventure"))),
    _movie("Your Name.", 2016, "Two teenagers who have never met begin swapping bodies across distance and time, and try to find each other.", 74.2, (("16", "Animation"), ("10749", "Romance"), ("14", "Fantasy"))),
    _movie("The Social Network", 2010, "The founding of Facebook told through duelling lawsuits between the people who built it.", 77.5, (("18", "Drama"), ("36", "History"))),
    _movie("Gladiator", 2000, "A betrayed Roman general is sold into slavery and fights his way back toward the emperor who destroyed his family.", 80.3, (("28", "Action"), ("18", "Drama"), ("12", "Adventure"))),
    _movie("Se7en", 1995, "Two detectives hunt a killer who works his murders around the seven deadly sins.", 75.7, (("80", "Crime"), ("53", "Thriller"), ("9648", "Mystery"))),
    _movie("Goodfellas", 1990, "Three decades in the life of a mob associate, from the thrill of the rise to the paranoia of the fall.", 74.0, (("80", "Crime"), ("18", "Drama"))),
    _movie("Alien", 1979, "The crew of a commercial towing ship answers a distress signal and brings aboard a creature that hunts them one by one.", 70.4, (("27", "Horror"), ("878", "Science Fiction"))),
    _movie("The Thing", 1982, "Antarctic researchers find an alien organism that mimics the people it kills, and start doubting each other.", 68.1, (("27", "Horror"), ("878", "Science Fiction"), ("53", "Thriller"))),
    _movie("Jaws", 1975, "A police chief on a resort island sets out to kill the great white shark that is eating his tourists.", 69.7, (("53", "Thriller"), ("12", "Adventure"), ("27", "Horror"))),
    _movie("Jurassic Park", 1993, "A billionaire opens a park of cloned dinosaurs, and the systems keeping them contained start failing on opening day.", 79.2, (("12", "Adventure"), ("878", "Science Fiction"))),
    _movie("Back to the Future", 1985, "A teenager is thrown thirty years into the past by a DeLorean and has to engineer his own parents' romance.", 81.5, (("12", "Adventure"), ("878", "Science Fiction"), ("35", "Comedy"))),
    _movie("The Lion King", 1994, "A lion cub flees his home after his father's death and has to grow into a king.", 82.8, (("16", "Animation"), ("10751", "Family"), ("18", "Drama"))),
    _movie("Toy Story", 1995, "A boy's toys come to life, and a pull-string cowboy doll becomes jealous of a new spaceman action figure.", 80.1, (("16", "Animation"), ("10751", "Family"), ("35", "Comedy"))),
    _movie("WALL·E", 2008, "The last working trash-compacting robot on an abandoned Earth falls in love and accidentally saves humanity.", 74.8, (("16", "Animation"), ("10751", "Family"), ("878", "Science Fiction"))),
    _movie("Coco", 2017, "A boy from a music-hating family is pulled into the Land of the Dead and uncovers the truth about his ancestors.", 79.5, (("16", "Animation"), ("10751", "Family"), ("14", "Fantasy"))),
    _movie("Get Out", 2017, "A young Black photographer visits his white girlfriend's family estate and slowly realises the weekend is a trap.", 76.2, (("27", "Horror"), ("53", "Thriller"), ("9648", "Mystery"))),
    _movie("Knives Out", 2019, "A detective is hired to investigate the death of a crime novelist surrounded by relatives with motives.", 77.0, (("9648", "Mystery"), ("35", "Comedy"), ("80", "Crime"))),
    _movie("La La Land", 2016, "A jazz pianist and an aspiring actress fall in love in Los Angeles while their ambitions pull them apart.", 75.8, (("10749", "Romance"), ("18", "Drama"), ("10402", "Music"))),
    _movie("The Grand Budapest Hotel", 2014, "A legendary concierge and his lobby boy are caught up in a murder, a stolen painting and a family feud across three eras.", 72.3, (("35", "Comedy"), ("18", "Drama"))),
    _movie("Arrival", 2016, "A linguist is recruited to communicate with alien visitors and starts perceiving time differently from everyone around her.", 73.7, (("878", "Science Fiction"), ("18", "Drama"), ("9648", "Mystery"))),
    _movie("Gravity", 2013, "Two astronauts are left adrift after debris destroys their shuttle, with only each other and the void to work with.", 71.4, (("878", "Science Fiction"), ("53", "Thriller"), ("18", "Drama"))),
    _movie("The Prestige", 2006, "Two rival Victorian magicians destroy each other chasing the secret behind the perfect illusion.", 74.9, (("18", "Drama"), ("9648", "Mystery"), ("878", "Science Fiction"))),
    _movie("Memento", 2000, "A man who cannot form new memories hunts his wife's killer using tattoos and notes he leaves for himself.", 70.8, (("9648", "Mystery"), ("53", "Thriller"))),
    _movie("Upgrade", 2018, "A man whose body is implanted with an AI chip is given one chance to use it to hunt the men who killed his wife.", 69.3, (("878", "Science Fiction"), ("53", "Thriller"), ("28", "Action"))),
)


def _trailer_url(movie: BundledMovie) -> str | None:
    key = TRAILER_KEYS.get(movie.title)
    if key is None:
        raise ValueError(
            f"no trailer id for bundled movie {movie.title!r}; every entry in "
            "BUNDLED_CATALOG needs one in TRAILER_KEYS"
        )
    return f"{YOUTUBE_WATCH_URL}{key}"


def bundled_rows() -> list[dict]:
    """Bundled catalog shaped for `MovieRepository.upsert_movie`."""
    return [
        {
            "provider": BUNDLED_PROVIDER,
            "provider_id": _slug(movie.title, movie.year),
            "title": movie.title,
            "overview": movie.overview,
            "release_date": date(movie.year, 1, 1),
            "poster_url": None,
            "backdrop_url": None,
            "popularity": movie.popularity,
            "vote_average": round(6.5 + (movie.popularity % 18) / 10, 1),
            "vote_count": int(movie.popularity * 900),
            "is_adult": False,
            "primary_trailer_url": _trailer_url(movie),
            "genres": movie.genres,
        }
        for movie in BUNDLED_CATALOG
    ]
