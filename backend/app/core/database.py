import ssl

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from .config import settings

# Strip query params — asyncpg takes SSL via connect_args, not the URL.
_url = settings.database_url.split("?")[0]

connect_args: dict = {"statement_cache_size": 0}

if settings.db_ssl:
    # Managed Postgres (e.g. Neon). Skip cert verification — the Windows CA store
    # often lacks the provider's chain in dev. Tighten for production if needed.
    _ssl_ctx = ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = ssl.CERT_NONE
    connect_args["ssl"] = _ssl_ctx

engine = create_async_engine(
    _url,
    echo=False,
    pool_pre_ping=True,
    connect_args=connect_args,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
