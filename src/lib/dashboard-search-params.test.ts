import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardHrefFromSearchParamsObject,
  buildSubastaDetailHref,
  parseDashboardClosingFilter,
  parseDashboardRecommendationFilter,
  parseDashboardScoreFilter,
  parseDashboardSortMode,
  parseDashboardStatusFilter,
} from "./dashboard-search-params";

test("parseDashboardSortMode only accepts supported order values", () => {
  assert.equal(parseDashboardSortMode("ia"), "ia");
  assert.equal(parseDashboardSortMode("descuento"), "descuento");
  assert.equal(parseDashboardSortMode("cierre"), "cierre");
  assert.equal(parseDashboardSortMode("valor"), "valor");
  assert.equal(parseDashboardSortMode("otra"), "");
  assert.equal(parseDashboardSortMode(undefined), "");
});

test("parseDashboardRecommendationFilter only accepts supported recommendation values", () => {
  assert.equal(parseDashboardRecommendationFilter("comprar"), "comprar");
  assert.equal(parseDashboardRecommendationFilter("observar"), "observar");
  assert.equal(parseDashboardRecommendationFilter("descartar"), "descartar");
  assert.equal(parseDashboardRecommendationFilter("pendiente"), "");
});

test("parseDashboardStatusFilter defaults to active auctions", () => {
  assert.equal(parseDashboardStatusFilter("activas"), "activas");
  assert.equal(parseDashboardStatusFilter("inactivas"), "inactivas");
  assert.equal(parseDashboardStatusFilter("todas"), "todas");
  assert.equal(parseDashboardStatusFilter("historico"), "activas");
  assert.equal(parseDashboardStatusFilter(undefined), "activas");
});

test("parseDashboardClosingFilter only accepts supported closing windows", () => {
  assert.equal(parseDashboardClosingFilter("7"), "7");
  assert.equal(parseDashboardClosingFilter("14"), "14");
  assert.equal(parseDashboardClosingFilter("30"), "30");
  assert.equal(parseDashboardClosingFilter("sin-fecha"), "sin-fecha");
  assert.equal(parseDashboardClosingFilter("90"), "");
});

test("parseDashboardScoreFilter only accepts supported score thresholds", () => {
  assert.equal(parseDashboardScoreFilter("60"), "60");
  assert.equal(parseDashboardScoreFilter("70"), "70");
  assert.equal(parseDashboardScoreFilter("80"), "80");
  assert.equal(parseDashboardScoreFilter("100"), "");
});

test("buildSubastaDetailHref keeps the dashboard query when opening a dossier", () => {
  assert.equal(
    buildSubastaDetailHref(
      "SUB/123 45",
      "q=madrid&estado=inactivas&recomendacion=comprar&page=2"
    ),
    "/subastas/SUB%2F123%2045?q=madrid&estado=inactivas&recomendacion=comprar&page=2"
  );
  assert.equal(buildSubastaDetailHref("ABC", ""), "/subastas/ABC");
});

test("buildDashboardHrefFromSearchParamsObject keeps only dashboard params", () => {
  assert.equal(
    buildDashboardHrefFromSearchParamsObject({
      q: "madrid",
      provincia: "Madrid",
      estado: "todas",
      tipo: "vivienda",
      cierre: "14",
      score: "70",
      view: "cards",
      favoritos: "1",
      recomendacion: "comprar",
      orden: "cierre",
      debug: "1",
    }),
    "/dashboard?q=madrid&provincia=Madrid&estado=todas&tipo=vivienda&cierre=14&score=70&view=cards&favoritos=1&recomendacion=comprar&orden=cierre"
  );
});
