import React from "react";
import {
  HeroComponent,
  RichTextComponent,
  ImageBlockComponent,
  ColumnsComponent,
  SpacerComponent,
  DividerComponent,
  AccordionComponent,
  BannerComponent,
  ContactInfoComponent,
  ProductGridComponent,
  FeaturedProductsComponent,
  CategoryListComponent,
  FreeShippingBarComponent,
  LatestPostsComponent,
} from "./components";

interface PuckItem {
  type: string;
  props?: Record<string, any>;
  [key: string]: any;
}

export interface PuckDataStructure {
  content?: PuckItem[];
  root?: { props?: Record<string, any> };
  zones?: Record<string, PuckItem[]>;
}

const COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  Hero: HeroComponent,
  RichText: RichTextComponent,
  ImageBlock: ImageBlockComponent,
  Columns: ColumnsComponent,
  Spacer: SpacerComponent,
  Divider: DividerComponent,
  Accordion: AccordionComponent,
  Banner: BannerComponent,
  ContactInfo: ContactInfoComponent,
  ProductGrid: ProductGridComponent,
  FeaturedProducts: FeaturedProductsComponent,
  CategoryList: CategoryListComponent,
  FreeShippingBar: FreeShippingBarComponent,
  LatestPosts: LatestPostsComponent,
};

/**
 * Storefront RSC renderer for Puck pages.
 * Renders page components directly without pulling @puckeditor/core into public bundles.
 */
export function RenderPuckContent({ data }: { data?: PuckDataStructure | null }) {
  if (!data || !Array.isArray(data.content) || data.content.length === 0) {
    return null;
  }

  return (
    <div className="puck-content w-full">
      {data.content.map((item, index) => {
        const Component = COMPONENT_MAP[item.type];
        if (!Component) {
          return null; // Ignore unknown or deprecated components safely
        }
        return <Component key={item.props?.id || index} {...(item.props || {})} />;
      })}
    </div>
  );
}
