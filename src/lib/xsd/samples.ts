/** Fictional demo schemas — synthetic sample data only. */
export const SAMPLE_ORDER_V1 = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           targetNamespace="urn:demo:orders:v1"
           xmlns="urn:demo:orders:v1"
           elementFormDefault="qualified">

  <xs:import namespace="urn:demo:common:v1" schemaLocation="common-v1.xsd"/>

  <xs:element name="purchaseOrder" type="PurchaseOrderType">
    <xs:annotation>
      <xs:documentation>Root element of a demo purchase order.</xs:documentation>
    </xs:annotation>
  </xs:element>

  <xs:complexType name="PurchaseOrderType">
    <xs:annotation>
      <xs:documentation>A synthetic purchase order used for demos.</xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="orderId" type="xs:string"/>
      <xs:element name="orderDate" type="xs:date"/>
      <xs:element name="customer" type="CustomerType"/>
      <xs:element name="line" type="LineItemType" maxOccurs="unbounded"/>
      <xs:element name="status" type="OrderStatusType"/>
    </xs:sequence>
    <xs:attribute name="currency" type="xs:string" use="required"/>
  </xs:complexType>

  <xs:complexType name="CustomerType">
    <xs:sequence>
      <xs:element name="customerId" type="xs:string"/>
      <xs:element name="displayName" type="xs:string"/>
      <xs:element name="email" type="xs:string" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="LineItemType">
    <xs:annotation>
      <xs:documentation>One ordered product line.</xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="sku" type="xs:string"/>
      <xs:element name="quantity" type="xs:int"/>
      <xs:element name="unitPrice" type="xs:decimal"/>
    </xs:sequence>
  </xs:complexType>

  <xs:simpleType name="OrderStatusType">
    <xs:annotation>
      <xs:documentation>Lifecycle status of the order.</xs:documentation>
    </xs:annotation>
    <xs:restriction base="xs:string">
      <xs:enumeration value="DRAFT"/>
      <xs:enumeration value="SUBMITTED"/>
      <xs:enumeration value="SHIPPED"/>
    </xs:restriction>
  </xs:simpleType>

  <xs:simpleType name="legacy_code">
    <xs:restriction base="xs:string">
      <xs:maxLength value="8"/>
    </xs:restriction>
  </xs:simpleType>
</xs:schema>
`;

export const SAMPLE_ORDER_V2 = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           targetNamespace="urn:demo:orders:v2"
           xmlns="urn:demo:orders:v2"
           elementFormDefault="qualified">

  <xs:import namespace="urn:demo:common:v2" schemaLocation="common-v2.xsd"/>
  <xs:include schemaLocation="order-extensions.xsd"/>

  <xs:element name="purchaseOrder" type="PurchaseOrderType">
    <xs:annotation>
      <xs:documentation>Root element of a demo purchase order (v2).</xs:documentation>
    </xs:annotation>
  </xs:element>

  <xs:complexType name="PurchaseOrderType">
    <xs:annotation>
      <xs:documentation>A synthetic purchase order used for demos.</xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="orderId" type="xs:string"/>
      <xs:element name="orderDate" type="xs:dateTime"/>
      <xs:element name="customer" type="CustomerType"/>
      <xs:element name="line" type="LineItemType" maxOccurs="unbounded"/>
      <xs:element name="status" type="OrderStatusType"/>
      <xs:element name="deliveryNote" type="xs:string" minOccurs="0"/>
    </xs:sequence>
    <xs:attribute name="currency" type="xs:string" use="required"/>
    <xs:attribute name="channel" type="xs:string"/>
  </xs:complexType>

  <xs:complexType name="CustomerType">
    <xs:sequence>
      <xs:element name="customerId" type="xs:string"/>
      <xs:element name="displayName" type="xs:string"/>
      <xs:element name="email" type="xs:string"/>
      <xs:element name="segment" type="xs:string" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="LineItemType">
    <xs:sequence>
      <xs:element name="sku" type="xs:string"/>
      <xs:element name="quantity" type="xs:int"/>
      <xs:element name="unitPrice" type="xs:decimal"/>
      <xs:element name="discount" type="xs:decimal" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>

  <xs:simpleType name="OrderStatusType">
    <xs:restriction base="xs:string">
      <xs:enumeration value="DRAFT"/>
      <xs:enumeration value="SUBMITTED"/>
      <xs:enumeration value="SHIPPED"/>
      <xs:enumeration value="CANCELLED"/>
    </xs:restriction>
  </xs:simpleType>
</xs:schema>
`;

export const SAMPLE_COMMON = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           targetNamespace="urn:demo:common:v1"
           elementFormDefault="qualified">
  <xs:complexType name="AddressType">
    <xs:annotation>
      <xs:documentation>Fictional postal address for demo payloads.</xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="street" type="xs:string"/>
      <xs:element name="city" type="xs:string"/>
      <xs:element name="postalCode" type="xs:string"/>
      <xs:element name="country" type="CountryCodeType"/>
    </xs:sequence>
  </xs:complexType>

  <xs:simpleType name="CountryCodeType">
    <xs:restriction base="xs:string">
      <xs:enumeration value="NL"/>
      <xs:enumeration value="BE"/>
      <xs:enumeration value="DE"/>
    </xs:restriction>
  </xs:simpleType>

  <xs:complexType name="UnusedAuditType">
    <xs:sequence>
      <xs:element name="changed_by" type="xs:string"/>
      <xs:element name="changedAt" type="xs:dateTime"/>
    </xs:sequence>
  </xs:complexType>
</xs:schema>
`;

export const SAMPLES = [
  { fileName: "order-v1.xsd", content: SAMPLE_ORDER_V1 },
  { fileName: "order-v2.xsd", content: SAMPLE_ORDER_V2 },
  { fileName: "common-v1.xsd", content: SAMPLE_COMMON },
];
