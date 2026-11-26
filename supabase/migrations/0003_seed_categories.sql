-- Story 1.5: the twelve categories of SRS 5.2, in that order. Subcategories and chapters are
-- created by the admin (Story 7.5). The Urdu names are AI drafts until the admin has checked them
-- (NFR-6.4). `on conflict do nothing`: running this again never overwrites an admin's rename.

insert into public.category (id, name_en, name_ur, position) values
  ('arithmetic-and-numbers',      'Arithmetic and Numbers',      'حساب اور اعداد',            1),
  ('algebra',                     'Algebra',                     'الجبرا',                    2),
  ('geometry',                    'Geometry',                    'جیومیٹری',                  3),
  ('trigonometry',                'Trigonometry',                'مثلثیات',                   4),
  ('coordinate-geometry',         'Coordinate Geometry',         'کوآرڈینیٹ جیومیٹری',        5),
  ('functions-and-graphs',        'Functions and Graphs',        'فنکشنز اور گراف',           6),
  ('vectors',                     'Vectors',                     'ویکٹرز',                    7),
  ('complex-numbers',             'Complex Numbers',             'مخلوط اعداد',               8),
  ('calculus',                    'Calculus',                    'کیلکولس',                   9),
  ('series-and-discrete-maths',   'Series and Discrete Maths',   'سلسلے اور منقطع ریاضی',     10),
  ('statistics-and-probability',  'Statistics and Probability',  'شماریات اور احتمال',        11),
  ('linear-algebra',              'Linear Algebra',              'خطی الجبرا',                12)
on conflict (id) do nothing;
