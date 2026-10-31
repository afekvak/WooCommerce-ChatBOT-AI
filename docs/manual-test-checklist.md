# Assistant manual test checklist

Use this file to test one feature at a time. **These are test cases, not claims that every case has passed on your store.** See [product-management.md](product-management.md) for coverage and limitations.

## Instructions and fixtures

1. Prefer a staging store. Use disposable draft products with a unique prefix such as `QA-20261023-A`.
2. Replace `<PLACEHOLDERS>` with actual values before sending a prompt. Do not paste the brackets as real IDs.
3. Run rows in order within each section. Inspect every preview before confirming. Verify writes independently in WooCommerce admin: an assistant saying “done” is not proof.
4. Replace `Pending` with `Pass`, `Fail`, `Blocked` (missing prerequisite/network/permission), or `N/A` (unsupported store feature). Record failures using the template below.
5. Leave destructive cleanup until the end. A **PERMANENT** preview must clearly warn you. Only delete test resources.
6. Use the store's currency, weight/dimension units and timezone. Later tests overwrite earlier settings, so verify immediately. Create extra fixtures if necessary.

No store changes are executed by this document. All manual cases start Pending.

| Run detail | Your value |
| --- | --- |
| Test date, timezone and run prefix `<RUN>` | |
| Store URL and staging/live | |
| WooCommerce version and relevant plugins | |
| Backend commit/version | |
| LLM_MODEL and CHAT_DEBUG_BLOCKS setting | |

| Placeholder | Meaning | Your value |
| --- | --- | --- |
| `<P1>`, `<P2>`, `<P3>` | Draft simple test products; P3 is disposable cleanup fixture | |
| `<VP>` | Variable parent product | |
| `<V1>`, `<V2>` | Variations under VP | |
| `<CAT>`, `<SUBCAT>`, `<TAG>` | Category, child category and tag | |
| `<ATTR>`, `<TERM1>`, `<TERM2>` | Global Color attribute and Blue/Red terms | |
| `<CLASS>`, `<CLASS_SLUG>`, `<BRAND>` | Shipping class, its slug and optional brand | |
| `<REVIEW>` | Genuine review on a disposable product | |
| `<IMG1>`, `<IMG2>`, `<IMG3>` | Direct public image URLs the store can download | |
| `<MEDIA1>`, `<MEDIA2>` | Existing WordPress image attachment IDs | |
| `<FILE_URL>` | Accessible downloadable test file | |
| `<START>`, `<END>` | Future ISO sale timestamps in the store timezone | |

## 1. Create, identify and read products

| ID | What to say | Expected result / check | Result |
| --- | --- | --- | --- |
| SET-01 | Create a draft simple product called QA-<RUN>-Shirt-A, SKU QA-<RUN>-A, regular price 100, managed stock quantity 20. | Preview, then confirmed draft. Record P1. | pass ✅✅|
| SET-02 | Create a draft simple product called QA-<RUN>-Shirt-B, SKU QA-<RUN>-B, regular price 80. | Separate product; record P2. | pass ✅✅|
| SET-03 | Create a draft product called QA-<RUN>-Disposable at price 10. | Record P3 for cleanup. | pass ✅✅|
| SET-04 | Add a product. | Guided questions for missing fields; cancel after checking. | pass ✅✅ |
| READ-01 | Show me QA-<RUN>-Shirt-A. | Resolves the correct product by name. | pass ✅✅ |
| READ-02 | Show the product with SKU QA-<RUN>-A. | Resolves P1 by SKU. | pass ✅✅ |
| READ-03 | Show product <P1>. | Correct current product by ID. | pass ✅✅ |
| READ-04 | Show my products. | Readable list/cards; no repeated field dump below cards. | pass ✅✅ |
| READ-05 | Show draft products whose names contain QA-<RUN>. | Both filters respected. | pass ✅✅ |
| READ-06 | Find in-stock shirts priced between 50 and 150. | Correct search, stock and price filters. | pass ✅✅ |
| READ-07 | Show products in category <CAT>. | Run after assigning the category. | pass ✅✅ |
| READ-08 | Show products tagged with tag ID <TAG>. | Correct tag membership. | pass ✅✅ |
| READ-09 | Show products that are on sale. | Fresh current sale status. | pass ✅✅ |
| READ-10 | Show featured products. | Only featured items. |  pass ✅✅ |
| READ-11 | Show variable products. | Correct type filtering. | pass ✅✅ |
| READ-12 | Show only products <P1> and <P2>. | Exact ID set. | pass ✅✅ |
| READ-13 | Show products ordered by price, highest first. | Descending numeric price order. | pass ✅✅ |
| READ-14 | Show page 1, one product per page, ordered by ID ascending. | One item; next page disclosed. | pass ✅✅ |
| READ-15 | Show page 2 with the same filters and ordering. | Next item, not repeated first page. | pass ✅✅ |
| READ-16 | Show all my products; tell me if more pages remain. | Does not pretend a limited page is the full catalog; follow-up may be needed. | pass ✅✅ |
| READ-17 | Show full details for <P1>. | Accurate details; no forced window expansion. |  pass ✅✅ |
| READ-18 | Show products created after <ISO_DATE>. | Correct date filter. | Pending |
| READ-19 | Show products with attribute <ATTRIBUTE_SLUG> and term ID <TERM1>. | Correct attribute filter after setup. | Pending |
| READ-20 | Show products excluding <P1>, ordered by ID ascending. | Exclusion respected. | Pending |

## 2. Product identity, content, status and visibility

| ID | What to say | Expected result / check | Result |
| --- | --- | --- | --- |
| EDIT-01 | Rename <P1> to QA-<RUN>-Shirt-A-Renamed. | Only name changes; use ID afterward. | Pending |
| EDIT-02 | Set <P1>'s slug to qa-<RUN>-shirt-a. | Slug saved, allowing WooCommerce normalization. | Pending |
| EDIT-03 | Change <P1>'s SKU to QA-<RUN>-A2. | New unique SKU saved. | Pending |
| EDIT-04 | Set <P1>'s short description to Lightweight cotton shirt. | Exact requested text. | Pending |
| EDIT-05 | Set <P1>'s full description to A cotton shirt designed for warm weather. | Full description updated. | Pending |
| EDIT-06 | Clear <P1>'s short description. | Empty value actually clears it. | Pending |
| EDIT-07 | Mark <P1> as featured. | Featured true. | Pending |
| EDIT-08 | Remove featured status from <P1>. | Featured false saved. | Pending |
| EDIT-09 | Hide <P1> from catalog and search. | Visibility hidden. | Pending |
| EDIT-10 | Show <P1> in catalog only, not search. | Visibility catalog. | Pending |
| EDIT-11 | Show <P1> in search only, not catalog. | Visibility search. | Pending |
| EDIT-12 | Make <P1> visible in catalog and search. | Visibility visible. | Pending |
| EDIT-13 | Publish <P3>. | Only disposable P3 published after confirmation. | Pending |
| EDIT-14 | Set <P3> to pending review. | Status pending. | Pending |
| EDIT-15 | Make <P3> private. | Status private. | Pending |
| EDIT-16 | Return <P3> to draft. | Status draft. | Pending |
| EDIT-17 | Enable reviews for <P1>. | Reviews true. | Pending |
| EDIT-18 | Disable reviews for <P1>. | Reviews false. | Pending |
| EDIT-19 | Set <P1>'s purchase note to Wash cold and air dry. | Exact text. | Pending |
| EDIT-20 | Set <P1>'s menu order to 5. | Integer saved. | Pending |
| EDIT-21 | Set <P1>'s global unique identifier to <VALID_GTIN>. | Supported identifier saved, version dependent. | Pending |

## 3. Prices and sale schedules

Reset P1 to regular price 100, no sale price, before starting. Check each row immediately.

| ID | What to say | Expected result / check | Result |
| --- | --- | --- | --- |
| PRICE-01 | Set <P1>'s regular price to 120. | Preview/final price 120. | Pending |
| PRICE-02 | Increase <P1>'s regular price by 10%. | 132; single-product workflow, not bulk. | Pending |
| PRICE-03 | Decrease <P1>'s regular price by 10%. | 118.80, calculated from fresh price. | Pending |
| PRICE-04 | Set <P1>'s sale price to 90. | Regular price retained. | Pending |
| PRICE-05 | Increase <P1>'s sale price by 5%. | Sale price 94.50. | Pending |
| PRICE-06 | Remove the sale price from <P1>. | Sale price cleared. | Pending |
| PRICE-07 | Set <P1>'s sale price to 90, from <START> to <END>, in the store timezone. | Both dates and sale price correct. | Pending |
| PRICE-08 | Clear both sale schedule dates for <P1>, retaining the sale price. | Explicit null reset through catalog workflow. | Pending |
| PRICE-09 | Set <P1>'s sale schedule using UTC timestamps <UTC_START> and <UTC_END>. | GMT fields map to intended store dates. | Pending |
| PRICE-10 | Set <P1>'s regular price to 0. | Zero saved; verify admin even if card formatting is unclear. | Pending |
| PRICE-11 | Set <P1>'s regular price to 100 and remove its sale price. | Baseline restored. | Pending |
| PRICE-12 | Increase its regular price by 10%. | Recent reference resolves to P1. | Pending |

## 4. Stock and backorders

| ID | What to say | Expected result / check | Result |
| --- | --- | --- | --- |
| STOCK-01 | Enable stock management on <P1>, quantity 15. | Both settings saved. | Pending |
| STOCK-02 | Set <P1>'s quantity to 0. | Zero saved, not ignored. | Pending |
| STOCK-03 | Set <P1>'s status to out of stock. | Correct stock status, not publication status. | Pending |
| STOCK-04 | Set <P1>'s quantity to 20 and stock status to in stock. | Both correct. | Pending |
| STOCK-05 | Allow backorders for <P1> with customer notification. | Backorders notify. | Pending |
| STOCK-06 | Allow backorders for <P1> without notification. | Backorders yes. | Pending |
| STOCK-07 | Disable backorders for <P1>. | Backorders no. | Pending |
| STOCK-08 | Sell <P1> individually, at most one per order. | Sold-individually true. | Pending |
| STOCK-09 | Allow multiple quantities of <P1> per order. | Sold-individually false. | Pending |
| STOCK-10 | Disable stock management for <P1>. | Manage-stock false. | Pending |
| STOCK-11 | Enable stock management and backorders on <P1>; set quantity to -2. | Signed integer accepted if store allows it. Restore afterward. | Pending |

## 5. Images and gallery preservation

Record current media IDs and order after uploads. A URL import may receive a new attachment ID. Removing a product image does not mean deleting the media-library file.

| ID | What to say / do | Expected result / check | Result |
| --- | --- | --- | --- |
| IMG-01 | Replace <P1>'s entire gallery with <IMG1> and <IMG2>, in that order. | Explicit whole-gallery replacement; first becomes main image. | Pending |
| IMG-02 | Change <P1>'s main image to <IMG3>, keeping the other gallery images. | Other gallery IDs retained. | Pending |
| IMG-03 | Add <IMG1> to the end of <P1>'s gallery. | Existing order/images retained. | Pending |
| IMG-04 | Use existing media ID <MEDIA1> as main image of <P1>, preserving other images. | Existing attachment used; no gallery loss. | Pending |
| IMG-05 | Remove image <MEDIA2> from <P1>'s gallery. | Only that product-image association removed. | Pending |
| IMG-06 | Remove the image with exact URL <EXISTING_IMAGE_URL> from <P1>. | Only matching gallery image removed. | Pending |
| IMG-07 | Set alt text of image <MEDIA1> on <P1> to Blue cotton shirt, front view; retain the entire gallery. | Correct alt text; every other image preserved. | Pending |
| IMG-08 | Set the name of image <MEDIA1> on <P1> to QA shirt front; retain the gallery. | Image name changes without gallery loss. | Pending |
| IMG-09 | Put <MEDIA2> first and <MEDIA1> second in <P1>'s gallery; keep other images after them. | Correct order; no duplicates or missing images. | Pending |
| IMG-10 | Remove all images from <P1>. | Empty gallery only after confirmation. | Pending |
| IMG-11 | Set <P1>'s main image to <IMG1>. | Works on an empty gallery. | Pending |
| IMG-12 | Prepare main-image change to <IMG2>; manually change gallery in WooCommerce before confirming. | Refuses stale preview; requests fresh one without overwriting new gallery. | Pending |
| IMG-13 | Change <P1>'s main image to https://example.com/not-an-image. | Clear import error if no image is served; no false success. | Pending |
| IMG-14 | Change <P1>'s image to javascript:alert(1). | Invalid URL rejected. | Pending |
| IMG-15 | Remove <NONEXISTENT_MEDIA_ID> from <P1>'s gallery. | Reports no such gallery image; no destructive change. | Pending |

## 6. Physical, tax, downloads and other product types

| ID | What to say | Expected result / check | Result |
| --- | --- | --- | --- |
| PHYS-01 | Set <P1>'s weight to 0.5 and dimensions to length 20, width 15, height 3. | Store's units used. | Pending |
| PHYS-02 | Change only <P1>'s height to 4. | Length/width preserved. | Pending |
| PHYS-03 | Clear <P1>'s weight. | Empty measurement saved. | Pending |
| PHYS-04 | Make <P1> virtual. | Virtual true. | Pending |
| PHYS-05 | Make <P1> physical again. | Virtual false. | Pending |
| TAX-01 | Make <P1> taxable and assign tax class <EXISTING_TAX_SLUG>. | Actual class slug, not invented ID. | Pending |
| TAX-02 | Set <P1>'s tax status to shipping only. | Tax status shipping. | Pending |
| TAX-03 | Make <P1> non-taxable. | Tax status none. | Pending |
| TAX-04 | Assign the standard tax class to <P1>. | Correct empty class slug. | Pending |
| FILE-01 | Make <P3> virtual and downloadable; attach <FILE_URL> as QA test file. | Downloads array and flags correct; verify file access separately. | Pending |
| FILE-02 | Set <P3>'s download limit to 3 and expiry to 7 days. | Both saved. | Pending |
| FILE-03 | Make <P3>'s download limit and expiry unlimited. | Both -1. | Pending |
| FILE-04 | Remove all files from <P3> and disable downloadable. | Empty array and false saved. | Pending |
| EXT-01 | Create a draft external product QA-<RUN>-External with URL https://example.com/qa-item and button text Visit supplier. | Correct type/URL/button; record ID. | Pending |
| GROUP-01 | Create a draft grouped product QA-<RUN>-Group containing <P1> and <P2>. | Exact grouped IDs; record ID. | Pending |
| LINK-01 | Set <P2> as an upsell of <P1>. | Upsell ID correct. | Pending |
| LINK-02 | Set <P2> as a cross-sell of <P1>. | Cross-sell ID correct. | Pending |
| LINK-03 | Clear all upsells and cross-sells from <P1>. | Both empty arrays applied. | Pending |
| LINK-04 | Set disposable grouped product <GROUP_ID>'s parent ID to 0. | Explicit parent reset accepted if applicable. | Pending |
| CUSTOM-01 | Set <P1>'s country of origin to US, customs description Cotton shirt, and commodity code <VALID_CODE>. | Compatible stores only; valid customs values. | Pending |
| CUSTOM-02 | Clear <P1>'s country of origin and customs description using null. | Explicit null resets; no unrelated clearing. | Pending |
| META-01 | Set metadata key qa_<RUN>_note on <P1> to manual test. | Exact supplied key/value; other metadata retained. | Pending |
| META-02 | Update metadata qa_<RUN>_note on <P1> to checked. | Existing key updated, no invented plugin key. | Pending |

## 7. Categories, tags, attributes, terms and shipping classes

| ID | What to say | Expected result / check | Result |
| --- | --- | --- | --- |
| CAT-01 | Create product category QA-<RUN>-Summer. | Record CAT. | Pending |
| CAT-02 | Show categories whose names contain QA-<RUN>. | Filtered list. | Pending |
| CAT-03 | Show category <CAT>. | Correct item. | Pending |
| CAT-04 | Rename <CAT> to QA-<RUN>-Summer-Updated and describe it as Summer test items. | Requested category fields only. | Pending |
| CAT-05 | Create category QA-<RUN>-Summer-Child under <CAT>. | Correct parent; record SUBCAT. | Pending |
| CAT-06 | Set category <CAT>'s image to <IMG1>. | Category image, not product image. | Pending |
| CAT-07 | Set category <CAT>'s display to subcategories and menu order to 2. | Correct settings. | Pending |
| CAT-08 | Add category <CAT> to <P1>, keeping its existing categories. | Reads/preserves existing IDs. | Pending |
| CAT-09 | Replace all categories of <P1> with only <CAT>. | Explicit replacement. | Pending |
| TAG-01 | Create product tag QA-<RUN>-Featured. | Record TAG. | Pending |
| TAG-02 | Show product tags matching QA-<RUN>. | Correct list. | Pending |
| TAG-03 | Show tag <TAG>. | Correct item. | Pending |
| TAG-04 | Rename <TAG> to QA-<RUN>-Featured-Updated and set description Test tag. | Correct term update. | Pending |
| TAG-05 | Add tag <TAG> to <P1>, keeping existing tags. | Existing tags retained. | Pending |
| TAG-06 | Remove all tags from <P1>. | Explicit empty array. | Pending |
| ATTR-01 | Create global product attribute QA-<RUN>-Color, select type. | Record ATTR. | Pending |
| ATTR-02 | List global product attributes. | Correct list; further pages work if needed. | Pending |
| ATTR-03 | Show attribute <ATTR>. | Correct item. | Pending |
| ATTR-04 | Set attribute <ATTR>'s ordering to name and enable archives. | Both settings saved. | Pending |
| ATTR-05 | Set attribute <ATTR>'s slug to qa-<RUN>-color. | Store may normalize global attribute slug; note resulting slug. | Pending |
| TERM-01 | Create term Blue under attribute <ATTR>. | Record TERM1. | Pending |
| TERM-02 | Create term Red under attribute <ATTR>. | Record TERM2. | Pending |
| TERM-03 | Show the terms of attribute <ATTR>. | Correct parent-scoped list. | Pending |
| TERM-04 | Show term <TERM1> under <ATTR>. | Correct term and parent. | Pending |
| TERM-05 | Describe term <TERM2> as Red test option and set menu order to 2. | Both term fields saved. | Pending |
| ATTR-06 | Assign attribute <ATTR> to <P1> with Blue/Red options, visible but not enabled for variations; retain other attributes. | Correct options, visibility, variation false and preserved attributes. | Pending |
| ATTR-07 | Add local attribute Material to <P1>, with Cotton/Linen options, visible; retain other attributes. | Local name used, not an invented global ID. | Pending |
| SHIP-01 | Create product shipping class QA-<RUN>-Heavy. | Record CLASS and CLASS_SLUG. | Pending |
| SHIP-02 | List product shipping classes. | Class appears. | Pending |
| SHIP-03 | Show shipping class <CLASS>. | Correct item. | Pending |
| SHIP-04 | Describe shipping class <CLASS> as Heavy test items. | Description saved. | Pending |
| SHIP-05 | Assign shipping class slug <CLASS_SLUG> to <P1>. | Existing class assigned; no shipping-zone rates changed. | Pending |
| SHIP-06 | Remove <P1>'s shipping class. | Empty slug clears assignment. | Pending |

## 8. Variable products and variations

Create ATTR and Blue/Red terms first. Use exact stored options. New variations require a variable parent with the relevant attributes enabled for variations.

| ID | What to say | Expected result / check | Result |
| --- | --- | --- | --- |
| VAR-01 | Create draft variable product QA-<RUN>-Variable-Shirt with attribute <ATTR>, Blue/Red options, visible and enabled for variations. | Correct parent setup; record VP. | Pending |
| VAR-02 | Create a draft Blue variation under <VP>, attribute <ATTR>, SKU QA-<RUN>-BLUE, regular price 89 and managed stock 10. | Record V1; no write before confirmation. | Pending |
| VAR-03 | Create a draft Red variation under <VP>, attribute <ATTR>, SKU QA-<RUN>-RED, regular price 95. | Record V2. | Pending |
| VAR-04 | Show all variations of <VP>. | Both appear; remaining pages disclosed if any. | Pending |
| VAR-05 | Show variation <V1> under <VP>. | Correct parent-scoped item. | Pending |
| VAR-06 | Set variation <V1> under <VP> to sale price 79 and quantity 5. | Only selected variation changes. | Pending |
| VAR-07 | Change variation <V1>'s image under <VP> to <IMG1>. | Variation image changes; parent gallery retained. | Pending |
| VAR-08 | Set variation <V2> under <VP> to inherit stock management from its parent. | Manage-stock parent value. | Pending |
| VAR-09 | Set <VP>'s default Color to Blue using attribute <ATTR>. | Correct default option. | Pending |
| VAR-10 | Set variation <V1>'s weight to 0.4 and tax class to <TAX_CLASS>, under <VP>. | Variation fields saved, parent unchanged. | Pending |
| VAR-11 | Set variation <V1>'s gallery image IDs to <MEDIA1> and <MEDIA2>, under <VP>. | Version-dependent feature works or clear error. | Pending |
| VAR-12 | Create a Blue variation under simple product <P1>. | Rejected: parent must be variable. | Pending |
| VAR-13 | Create a variation under <VP> using an attribute not enabled on that parent. | Rejects or requests parent setup; no invalid creation. | Pending |
| VAR-14 | Set the description of variation <V1> under <VP> to Blue test variation. | Correct variation description. | Pending |
| VAR-15 | Set variation <V1> under <VP> to draft. | Variation status update. | Pending |

## 9. Brands and authentic reviews

Brands require an installed compatible endpoint. Reviews must contain genuine content supplied by the tester; do not invent customer experiences.

| ID | What to say | Expected result / check | Result |
| --- | --- | --- | --- |
| BRAND-01 | Create product brand QA-<RUN>-Brand. | Record BRAND, or mark unsupported with actual error. | Pending |
| BRAND-02 | Show my product brands. | Correct list or clear endpoint error. | Pending |
| BRAND-03 | Show brand <BRAND>. | Correct item. | Pending |
| BRAND-04 | Rename <BRAND> to QA-<RUN>-Brand-Updated and set description Test brand. | Requested fields saved. | Pending |
| BRAND-05 | Assign brand <BRAND> to <P1>, keeping other brands. | Existing assignments retained. | Pending |
| BRAND-06 | Set brand <BRAND>'s image to <IMG1>. | Image saved, if supported. | Pending |
| REVIEW-01 | Create a review on <P3> with supplied reviewer <TESTER_NAME>, email <TEST_EMAIL>, rating 4 and text <GENUINE_REVIEW_TEXT>. Hold for moderation. | Exact supplied fields; status hold; record REVIEW. | Pending |
| REVIEW-02 | Show reviews for <P3>. | Correct product filter. | Pending |
| REVIEW-03 | Show review <REVIEW>. | Correct item. | Pending |
| REVIEW-04 | Hold review <REVIEW> for moderation. | Status hold. | Pending |
| REVIEW-05 | Approve review <REVIEW>. | Status approved after confirmation. | Pending |
| REVIEW-06 | Mark review <REVIEW> as spam. | Status spam. | Pending |
| REVIEW-07 | Update review <REVIEW> to rating 5 and corrected genuine text <CORRECTED_TEXT>. | Only requested fields updated. | Pending |

## 10. Bulk and batches

Use only test resources. Batches can partially succeed. Do not accidentally apply an “all products” operation to your real catalog.

| ID | What to say | Expected result / check | Result |
| --- | --- | --- | --- |
| BATCH-01 | Set regular prices of only <P1> and <P2> to 75. | Exact two IDs in preview and write. | Pending |
| BATCH-02 | For only <P1> and <P2>, set featured false and visibility hidden. | Structured multi-field updates. | Pending |
| BATCH-03 | Increase regular prices in category <CAT> by 10%. | Category contains only QA items; correct scope. | Pending |
| BATCH-04 | If the percentage wizard asks for direction, answer increase after already supplying 10%. | Retains percent; no “missing percent” loop. | Pending |
| BATCH-05 | Create tags QA-<RUN>-Batch-A and QA-<RUN>-Batch-B in one batch. | Both creates previewed; record IDs. | Pending |
| BATCH-06 | Set sale prices of <V1> and <V2> under <VP> to 70. | Same parent, exact variation IDs. | Pending |
| BATCH-07 | Batch-create Blue/Red draft variations under <FRESH_VARIABLE_PARENT>, with existing Color attribute <ATTR>, unique QA SKUs and prices 89/95. | Requires a fresh configured parent to avoid duplicate combinations. | Pending |
| BATCH-08 | In one batch set <P1> to price 60 and <P2> to price 65. | Different values per ID preserved. | Pending |
| BATCH-09 | In one batch rename <P1> and permanently delete <P1>. | Rejected: same ID in update and delete. | Pending |
| BATCH-10 | Prepare one batch with 101 explicit product updates. | Refuses/splits rather than exceeding 100. Use QA IDs only; otherwise mark N/A. | Pending |
| BATCH-11 | Prepare a batch deleting the disposable batch tags, without granting permanent deletion. | Requests permanent permission; no silent deletion. | Pending |
| BATCH-12 | Batch-create two disposable products with the same new SKU QA-<RUN>-DUPLICATE. | Staging only. Reports partial failures accurately; no automatic retry. Record successful fixtures. | Pending |
| BATCH-13 | Create multiple brands in one batch. | Explains brands are individual-only; no invented batch route. | Pending |

## 11. Confirmation, validation and side questions

| ID | What to say / do | Expected result / check | Result |
| --- | --- | --- | --- |
| SAFE-01 | Prepare <P1>'s price change to 123; do not confirm. | Store unchanged before confirmation. | Pending |
| SAFE-02 | Cancel that pending change. | Nothing written; state discarded. | Pending |
| SAFE-03 | Prepare again, then click Confirm once. | Exact previewed payload written. | Pending |
| SAFE-04 | Click Confirm repeatedly on a disposable prepared create. | No repeated execution of the same pending create. | Pending |
| SAFE-05 | While a change is pending, ask What was my last message? | Answers without consuming it as a wizard field or confirming. | Pending |
| SAFE-06 | While a change is pending, ask Show current details of <P2>. | Side read works; pending write unchanged. | Pending |
| SAFE-07 | Prepare a category update; wait over 15 minutes; confirm. | Generic preview expired; no write. | Pending |
| SAFE-08 | Prepare a change, restart backend, then type confirm. | Old in-memory preview cannot execute; fresh request may be needed. | Pending |
| SAFE-09 | Set <P1>'s regular price to -10. | Invalid negative price rejected. | Pending |
| SAFE-10 | Set <P1>'s stock quantity to 2.5. | Fractional inventory rejected. | Pending |
| SAFE-11 | Give <P1> the SKU currently used by <P2>. | Clear uniqueness error; no false success. | Pending |
| SAFE-12 | Update product <NONEXISTENT_ID>. | Not found; no guessed substitute. | Pending |
| SAFE-13 | Set <P1>'s total_sales field to 999. | Read-only field rejected. | Pending |
| SAFE-14 | Change an SEO title using a made-up plugin field. | Unsupported field/clarification; no invented extension route. | Pending |
| SAFE-15 | Increase only <P1>'s price by 10%. | Never expands scope to all products. | Pending |
| SAFE-16 | Ask to change a name shared by two QA products. | Resolves ambiguity before a write. | Pending |
| SAFE-17 | Prepare different changes in two chats, confirm only one. | No cross-chat pending-state leakage. | Pending |
| SAFE-18 | After a write timeout, ask for fresh current data before retrying. | Checks store state, not an assumed rollback. | Pending |

## 12. Memory and previous chats

Use a unique test preference. Forgetting a saved fact does not erase every historical message mentioning it.

| ID | What to say / do | Expected result / check | Result |
| --- | --- | --- | --- |
| MEM-01 | Remember that my QA test preference is to create draft products only. | Actual preference saved; no quote-validation error. | Pending |
| MEM-02 | What preferences have you saved about my store? | Includes test fact naturally; no raw JSON/UUIDs. | Pending |
| MEM-03 | Start New chat; ask What is my QA test preference? | Recalled across chats for the same account. | Pending |
| MEM-04 | Find the earlier chat about changing QA-<RUN>-Shirt-A's image. | Topic/date recall, no internal conversation IDs. | Pending |
| MEM-05 | Forget my QA preference about draft products only. | Correct fact removed; clarification if ambiguous. | Pending |
| MEM-06 | What explicitly saved preferences remain? | Forgotten fact not described as still saved. | Pending |
| MEM-07 | Discuss an old price, then ask for <P1>'s current price. | Fresh WooCommerce lookup, not remembered historical value. | Pending |

## 13. Chat UI, navigation, persistence and debug

| ID | Action | Expected result / check | Result |
| --- | --- | --- | --- |
| UI-01 | Send several messages with debug enabled. | One Today divider for today's messages, not one per reply/debug row. | Pending |
| UI-02 | Reopen a chat containing messages from multiple days. | Dividers only at day boundaries; correct Today/Yesterday labels. | Pending |
| UI-03 | Send enough messages to overflow history. | Header/composer reachable; only history scrolls. | Pending |
| UI-04 | Shift+Enter for a newline; Enter to send. | Correct multi-line behavior and one send. | Pending |
| UI-05 | Toggle theme, then reload. | Theme persists; text readable. | Pending |
| UI-06 | Open product details during an update. | No automatic window widening. | Pending |
| UI-07 | Use Expand, then collapse. | Manual window control works. | Pending |
| UI-08 | Open Your chats. | Sidebar expands left on desktop; current chat highlighted. | Pending |
| UI-09 | Create enough chats to overflow sidebar; scroll to last entry. | Independent scrolling; last chat/delete control reachable. | Pending |
| UI-10 | Switch between saved chats, then send a message. | Correct messages and selected conversation ownership. | Pending |
| UI-11 | Reload after selecting a chat. | Selected chat resumes. | Pending |
| UI-12 | Use New chat from toolbar/header and sidebar. | New conversation; old one remains saved. | Pending |
| UI-13 | Cancel a chat-delete confirmation. | Chat and selection unchanged. | Pending |
| UI-14 | Delete a disposable inactive chat. | Only selected chat removed; current chat retained. | Pending |
| UI-15 | Delete the active disposable chat. | New chat opens; old chat no longer selectable. | Pending |
| UI-16 | Use Clear chat on a disposable chat. | Messages/source-linked memories removed; chat itself retained. | Pending |
| UI-17 | Set CHAT_DEBUG_BLOCKS=true, restart backend, send a message. | Expandable Debug block; no extra frontend flag required. | Pending |
| UI-18 | Set CHAT_DEBUG_BLOCKS=false, restart backend, send a message. | No new debug block returned. | Pending |
| UI-19 | Test sidebar and chat on a narrow mobile viewport. | Can scroll/select/close sidebar; header/composer reachable. | Pending |
| UI-20 | Open a long confirmation modal. | Body scrolls; Cancel/Confirm remain visible. | Pending |
| UI-21 | Use Tab and Escape in a confirmation modal. | Usable focus; Escape cancels pending operation. | Pending |
| UI-22 | Simulate chat-list/deletion network failure on staging. | Error/retry; failed deletion does not remove or switch the saved chat. | Pending |

## 14. Destructive cleanup — run last

**PERMANENT** means the preview must warn that deletion cannot be undone. Remove test links first. Deleting terms can affect linked products; deleting a variable parent can affect its variations. Do not target pre-existing resources.

| ID | What to say | Expected result / check | Result |
| --- | --- | --- | --- |
| DEL-01 | Move disposable product <P3> to trash. | Trash, not permanent deletion. | Pending |
| DEL-02 | Restore <P3> as a draft. | Separate confirmed restore. | Pending |
| DEL-03 | Permanently delete disposable <P3>. | **PERMANENT** preview, then removal after confirmation. | Pending |
| DEL-04 | Delete disposable variation <V1> under <VP>. | **PERMANENT** warning; exact variation removed. | Pending |
| DEL-05 | Delete disposable review <REVIEW>. | **PERMANENT** warning; exact review. | Pending |
| DEL-06 | Delete disposable child category <SUBCAT>. | **PERMANENT**; unrelated categories retained. | Pending |
| DEL-07 | Delete disposable tag <TAG>. | **PERMANENT**; linked assignments checked. | Pending |
| DEL-08 | Delete disposable term <TERM2> under <ATTR>. | **PERMANENT**; correct parent. | Pending |
| DEL-09 | Delete disposable shipping class <CLASS>. | **PERMANENT**; product assignments checked. | Pending |
| DEL-10 | Delete disposable brand <BRAND>. | **PERMANENT**, if supported. | Pending |
| DEL-11 | Permanently batch-delete the disposable batch tags using their exact IDs. | Explicit permission; accurate per-item results. | Pending |
| DEL-12 | Delete the QA variable parent and remaining QA products. | Inspect every preview; no non-QA items selected. | Pending |
| DEL-13 | Delete QA attribute <ATTR> and category <CAT> after removing test links. | **PERMANENT**; linked terms/products accounted for. | Pending |
| DEL-14 | Remove external/grouped fixtures and products created by partial-batch tests. | All test resources accounted for. Imported media may remain; media-library deletion is not promised. | Pending |

## Boundaries and result reporting

Orders, customers, coupons, shipping-zone rates, subscriptions, bundles, arbitrary plugin routes, standalone media-library CRUD and unlimited autonomous jobs are not promised by this product-management implementation. Brands, customs fields and variation galleries depend on installed versions/extensions. A valid image URL must still be downloadable by the store.

Pending previews live in one backend process and are lost on restart. Generic catalog previews expire after 15 minutes. Batch writes are not transactions. A network error is not proof that a write rolled back: read current data before retrying.

### Failure report template

Copy once for each failed test; redact secrets.

```text
Test ID:
Date/time and store timezone:
Result: Fail / Blocked / N/A
Resource ID and parent ID:
Exact prompt:
Exact assistant reply:
Preview shown:
Confirmed or cancelled:
Expected result:
Actual result verified in WooCommerce:
Relevant Debug toolsUsed / error:
Screenshot path:
Steps to reproduce:
Retest date and result:
```

### Run summary

| Pending | Pass | Fail | Blocked | N/A |
| --- | --- | --- | --- | --- |
| | | | | |

Next failed test IDs to investigate:

- Add IDs here.
