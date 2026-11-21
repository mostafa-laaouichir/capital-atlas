# Model and reporting methodology

## Data model

`Capital_Stock` and `Key_Indicators` retain annual observations keyed by area, item, element and year. `Geography` filters both fact tables by **Area Code** and `Calendar` filters both by each observation’s **Year Start**. Each relationship is one-to-many from the dimension to the fact. The full calendar spans 1970–2024 in the development snapshot.

The shared Power Query loader opens each expected file directly from **DataFolder**, selects the columns used by the model, reads UTF-8 and parses decimal values with an explicit source locale. M49 remains text to preserve leading zeros. Geography selects and deduplicates area metadata before combining the two sources.

## Measures and comparisons

- **Fixed investment** is gross fixed capital formation for agriculture, forestry and fishing. **Depreciation** is consumption of fixed capital. **Net fixed investment** is the difference between the two.
- **Net capital stock** is a point-in-time asset balance after accumulated depreciation. It is evaluated at a single year.
- **Sector value added** measures the value created after intermediate inputs. **Share of GDP** uses the corresponding published FAOSTAT share. Changes in this share use percentage points.
- Dollar KPIs use **constant 2015 USD**. DAX base measures return blank when their area or year is ambiguous, or the underlying series is unavailable.
- Prior-window comparisons use annual averages over two equally long windows and require observations for every year in both windows to calculate a variance.
- Benchmark quadrants use the median of each measure for available peers in the current area type and year. The scatter uses asinh axes to make smaller observations easier to distinguish.

Country, region, group and world are separate published observation scopes. A country view can include territories or former geographic entities. Map coverage depends on the match between Natural Earth boundaries and FAOSTAT geography. The area dropdown covers geographic entries that do not have a clickable map shape.

## Performance and maintenance

Unused geography fields are excluded from the two trend visuals. The report embeds map data only in the overview and flag images only in pages that display them. Peer details renders a moving window of rows and sparklines as the reader scrolls. The record index groups observations by area type and year for the map and benchmarking queries inside the visual.

The four embedded visual resources decreased from 2.23 MB to 1.39 MB (38%). In the 1472 × 900 browser test, Peer details initially rendered 15 of 207 rows. The previous version rendered all 207 at once. The optimized table passed the search and last-row tests. These measurements describe resource size and rendering work. Refresh and page-load timings were not benchmarked.

Run `checks/model-smoke-test.dax` in Power BI Desktop’s DAX Query View after refreshing. The two fact counts, geography count and sample KPIs should reconcile to the expected development snapshot. New releases may change those baselines.

The `.pbi` cache contains local model data and settings. Keep it out of source control. For a Git checkout, set **DataFolder**, refresh, and save locally. Keep the two source CSVs local and use the links in the README to reproduce the import. [Microsoft Learn — Semantic model files](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset)
