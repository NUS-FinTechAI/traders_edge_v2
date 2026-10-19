from pydantic import Field
from app.api_schemas.shared_schema import BaseCommand
from typing import Literal
from pydantic import JsonValue, ConfigDict
from app.api_schemas.shared_schema import Payload
from app.api_schemas.challenge_schema import ChallengeWallet, ChallengeAwardAmounts


class EconomyCommand(BaseCommand):
    policy_version: Literal['1'] = '1'


class Purchase(EconomyCommand):
    item_id: str = Field(min_length=1, max_length=120)


class EconomyRules(Payload):
    login_stocks: int
    login_xp: int
    daily_victory_stocks: int
    refresh_premium_cost: int
    real_money_purchases: Literal[False]


class EconomyState(ChallengeWallet):
    rules: EconomyRules


class EconomyAward(Payload):
    wallet: ChallengeWallet
    awarded: ChallengeAwardAmounts


class EconomyRefresh(Payload):
    wallet: ChallengeWallet
    spent: dict[str, int]


class RewardItem(Payload):
    # Retired, owned snapshots retain their original public extension fields.
    model_config = ConfigDict(extra='allow')
    id: str
    kind: Literal['avatar', 'title', 'badge']
    name: str
    visual_key: str
    rule_version: str
    criteria: dict[str, JsonValue]
    status: Literal['owned', 'eligible', 'locked', 'available'] | None = None
    evidence: list[dict[str, JsonValue]] | None = None
    created_at: str | None = None
    shop_id: str | None = None
    currency: Literal['stocks', 'premium'] | None = None
    price: int | None = None
    week: str | None = None


class RewardEquipment(Payload):
    avatar_id: str | None
    title_id: str | None


class RewardInventory(Payload):
    items: list[RewardItem]
    equipment: RewardEquipment


class RewardClaim(Payload):
    item: RewardItem


class RewardEquipmentResponse(Payload):
    equipment: RewardEquipment


class ShopResponse(Payload):
    policy_version: str
    items: list[RewardItem]


class PurchaseResponse(Payload):
    item: RewardItem
    wallet: ChallengeWallet
    spent: dict[str, int]
