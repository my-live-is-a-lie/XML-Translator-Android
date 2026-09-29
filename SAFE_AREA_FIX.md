# Safe-area drawer fix

The right drawer header in `src/components/Header.tsx` must use:

```
pt-[max(0.875rem,env(safe-area-inset-top))]
```

instead of only `py-3.5`, so language and color controls are not hidden under the Android status bar.

**If Header.tsx is broken on main:** restore from commit `8737607d71cf8a352d0761a75a13c5f8dff32840` then apply that one className change.

```bash
git checkout 8737607d71cf8a352d0761a75a13c5f8dff32840 -- src/components/Header.tsx
# then edit the drawer header className as above
```
