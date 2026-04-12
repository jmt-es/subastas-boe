import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardHrefFromSearchParamsObject,
  buildSubastaDetailHref,
  parseDashboardRecommendationFilter,
  parseDashboardSortMode,
} from "./dashboard-search-params";

test("parseDashboardSortMode only accepts supported order values", () => {
  assert.equal(parseDashboardSortMode("ia"), "ia");
  assert.equal(parseDashboardSortMode("descuento"), "descuento");
  assert.equal(parseDashboardSortMode("otra"), "");
  assert.equal(parseDashboardSortMode(undefined), "");
});

test("parseDashboardRecommendationFilter only accepts supported recommendation values", () => {
  assert.equal(parseDashboardRecommendationFilter("comprar"), "comprar");
  assert.equal(parseDashboardRecommendationFilter("observar"), "observar");
  assert.equal(parseDashboardRecommendationFilter("descartar"), "descartar");
  assert.equal(parseDashboardRecommendationFilter("pendiente"), "");
});

test("buildSubastaDetailHref keeps the dashboard query when opening a dossier", () => {
  assert.equal(
    buildSubastaDetailHref("SUB/123 45", "q=madrid&recomendacion=comprar&page=2"),
    "/subastas/SUB%2F123%2045?q=madrid&recomendacion=comprar&page=2"
  );
  assert.equal(buildSubastaDetailHref("ABC", ""), "/subastas/ABC");
});

test("buildDashboardHrefFromSearchParamsObject keeps only dashboard params", () => {
  assert.equal(
    buildDashboardHrefFromSearchParamsObject({
      q: "madrid",
      provincia: "Madrid",
      view: "cards",
      favoritos: "1",
      recomendacion: "comprar",
      orden: "ia",
      debug: "1",
    }),
    "/dashboard?q=madrid&provincia=Madrid&view=cards&favoritos=1&recomendacion=comprar&orden=ia"
  );
});
