from extensions import db
from datetime import datetime
from sqlalchemy import Index, func
from sqlalchemy.orm import validates
import re

HEX_RE = re.compile(r"^#([0-9A-Fa-f]{6})$")

def _norm_name(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())

class Tag(db.Model):
    __tablename__ = "tags"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)        # nome “bonito” (como usuário digitou)
    slug = db.Column(db.String(80), nullable=False, unique=True, index=True)  # lower p/ unicidade
    color = db.Column(db.String(7), nullable=False)        # "#RRGGBB"
    created_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("uq_tags_slug", "slug", unique=True),
    )

    @validates("name")
    def _v_name(self, key, value):
        v = _norm_name(value)
        if not v:
            raise ValueError("Tag.name vazio")
        return v

    @validates("slug")
    def _v_slug(self, key, value):
        v = _norm_name(value).lower()
        if not v:
            raise ValueError("Tag.slug vazio")
        return v

    @validates("color")
    def _v_color(self, key, value):
        if not value or not HEX_RE.match(value):
            raise ValueError("Cor inválida: use formato #RRGGBB")
        return value
