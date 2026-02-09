# @pause/config

**Shared TypeScript configuration for the Pause monorepo.**

## Overview

This package provides the base `tsconfig.json` that all other packages and apps extend, ensuring consistent compiler settings across the workspace.

## Usage

In any package or app `tsconfig.json`:

```json
{
  "extends": "@pause/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  }
}
```

## Contents

| File | Purpose |
|------|---------|
| `tsconfig.base.json` | Base TypeScript compiler options shared across the monorepo |
