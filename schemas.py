from __future__ import annotations
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
import datetime


class ScenarioCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    assumptions_override: Dict[str, Any] = Field(default_factory=dict)


class ScenarioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    assumptions_override: Optional[Dict[str, Any]] = None


class ScenarioOut(BaseModel):
    id: int
    name: str
    description: str
    assumptions_override: Dict[str, Any]
    created_at: str
    updated_at: str


class BaselineOut(BaseModel):
    epi: Dict[str, Any]
    progression: Dict[str, Any]
    shares: Dict[str, Any]
    dot: Dict[str, Any]
    revenue: Dict[str, Any]
    sim: Dict[str, Any]
    lines: list
    segments: list
    classes: list
    lr_segment_ids: list
    lusp_classes: list
